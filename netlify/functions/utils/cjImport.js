import { getSupabaseAdmin } from './supabaseAdmin.js';
import { getProduct, getVariantInventory } from './cjClient.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// CJ's documented rate limit is 1 request/second — this keeps sequential
// per-variant stock lookups safely under that.
const CJ_REQUEST_GAP_MS = 1100;

function firstName(nameField) {
  return Array.isArray(nameField) ? nameField[0] : nameField;
}

// Best-effort match of a CJ variant to an existing storefront variant by
// name/property, so a re-sync links the right row instead of creating
// duplicates. Never guesses across products — only within the variants of
// the product being imported.
function matchStorefrontVariant(cjVariant, storefrontVariants) {
  const candidates = [cjVariant.variantNameEn, cjVariant.variantName, cjVariant.variantProperty, cjVariant.variantKey]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());

  return storefrontVariants.find((sv) => {
    const svName = sv.name.toLowerCase();
    return candidates.some((c) => c.includes(svName) || svName.includes(c));
  });
}

/**
 * Imports/refreshes one CJ product:
 *  1. Fetches the product + variants + per-variant stock from CJ.
 *  2. Mirrors the raw data into cj_products / cj_product_variants (private,
 *     service-role-only tables — CJ's sell price/cost never leaves these).
 *  3. Links (never overwrites) the storefront-facing products /
 *     product_variants / product_images rows via cj_product_id /
 *     cj_variant_id, creating draft (is_active = false) rows only for
 *     genuinely new products/variants that don't exist yet.
 *
 * @param {string} cjProductId
 * @param {{ targetSlug?: string }} [options] targetSlug: link to a specific
 *   existing storefront product by slug instead of matching by cj_product_id.
 */
export async function importCjProduct(cjProductId, { targetSlug } = {}) {
  const supabase = getSupabaseAdmin();

  const productResponse = await getProduct(cjProductId);
  const cj = productResponse?.data;
  if (!cj) {
    throw new Error(productResponse?.message || `CJ returned no data for product ${cjProductId}`);
  }

  const cjVariants = Array.isArray(cj.variants) ? cj.variants : [];

  // Per-variant stock, respecting CJ's 1 req/sec rate limit.
  const stockByVid = {};
  for (const v of cjVariants) {
    try {
      const stockRes = await getVariantInventory(v.vid);
      stockByVid[v.vid] = Array.isArray(stockRes?.data) ? stockRes.data : [];
    } catch (err) {
      // A single variant's stock failing shouldn't abort the whole import —
      // it just gets recorded with unknown/zero stock, visible for review.
      console.error(`[cjImport] stock lookup failed for vid ${v.vid}:`, err.message);
      stockByVid[v.vid] = [];
    }
    await sleep(CJ_REQUEST_GAP_MS);
  }

  // --- 1. Mirror raw CJ product data (cj_products) ---------------------
  const rawName = firstName(cj.productName);
  const cjSellPriceCents = typeof cj.sellPrice === 'number' ? Math.round(cj.sellPrice * 100) : null;

  const { data: cjProductRow, error: cjProductError } = await supabase
    .from('cj_products')
    .upsert(
      {
        cj_product_id: cjProductId,
        raw_name: rawName,
        raw_name_en: cj.productNameEn,
        raw_description: cj.description,
        category_id: cj.categoryId,
        category_name: cj.categoryName,
        product_sku: cj.productSku,
        cj_sell_price_cents: cjSellPriceCents,
        raw_images: cj.productImage ? [cj.productImage] : [],
        raw_response: cj,
        last_synced_at: new Date().toISOString()
      },
      { onConflict: 'cj_product_id' }
    )
    .select()
    .single();

  if (cjProductError) throw cjProductError;

  // --- 2. Resolve which storefront product this links to ---------------
  let storefrontProduct = null;

  if (targetSlug) {
    const { data } = await supabase.from('products').select('*').eq('slug', targetSlug).maybeSingle();
    storefrontProduct = data;
  }
  if (!storefrontProduct) {
    const { data } = await supabase.from('products').select('*').eq('cj_product_id', cjProductId).maybeSingle();
    storefrontProduct = data;
  }

  let createdNewProduct = false;
  if (!storefrontProduct) {
    // No existing storefront product to link to — create a draft (is_active
    // = false, never customer-visible) using CJ's data as a starting point.
    // The admin reviews/renames/re-prices before publishing; nothing here
    // is ever shown to a customer automatically.
    const slug = targetSlug || slugify(rawName || cjProductId);
    const { data: created, error: createError } = await supabase
      .from('products')
      .insert({
        slug,
        name: rawName || `CJ product ${cjProductId}`,
        short_description: null,
        description: cj.description || null,
        price_cents: cjSellPriceCents ?? 0,
        currency: 'EUR',
        cj_product_id: cjProductId,
        is_active: false
      })
      .select()
      .single();
    if (createError) throw createError;
    storefrontProduct = created;
    createdNewProduct = true;
  } else if (!storefrontProduct.cj_product_id) {
    // Link an existing storefront product to this CJ product without
    // touching any of its branding fields.
    await supabase.from('products').update({ cj_product_id: cjProductId }).eq('id', storefrontProduct.id);
  }

  // Update cj_products.product_id link now that we know it.
  await supabase.from('cj_products').update({ product_id: storefrontProduct.id }).eq('id', cjProductRow.id);

  // --- 3. Resolve/link each CJ variant -----------------------------------
  const { data: existingVariants } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', storefrontProduct.id);

  const variantResults = [];

  for (const cjVariant of cjVariants) {
    const stockRows = stockByVid[cjVariant.vid] || [];
    const totalStock = stockRows.reduce((sum, s) => sum + (s.totalInventoryNum ?? s.storageNum ?? 0), 0);
    const variantSellPriceCents =
      typeof cjVariant.variantSellPrice === 'number' ? Math.round(cjVariant.variantSellPrice * 100) : null;

    // Mirror raw variant data.
    const { data: cjVariantRow, error: cjVariantError } = await supabase
      .from('cj_product_variants')
      .upsert(
        {
          cj_product_row_id: cjProductRow.id,
          cj_variant_id: cjVariant.vid,
          cj_variant_sku: cjVariant.variantSku,
          raw_variant_name: cjVariant.variantName,
          raw_variant_name_en: cjVariant.variantNameEn,
          raw_variant_property: cjVariant.variantProperty,
          cj_sell_price_cents: variantSellPriceCents,
          image_url: cjVariant.variantImage,
          inventory_count: totalStock,
          warehouse_info: stockRows,
          raw_response: cjVariant,
          last_synced_at: new Date().toISOString()
        },
        { onConflict: 'cj_variant_id' }
      )
      .select()
      .single();

    if (cjVariantError) throw cjVariantError;

    let matched = existingVariants?.find((sv) => sv.cj_variant_id === cjVariant.vid);
    if (!matched) matched = matchStorefrontVariant(cjVariant, existingVariants || []);

    let storefrontVariantId;
    let action;

    if (matched) {
      // Link + refresh stock/SKU only — never touch name/price/hex_color,
      // which are the storefront's own branding decisions.
      await supabase
        .from('product_variants')
        .update({
          cj_variant_id: cjVariant.vid,
          cj_variant_sku: cjVariant.variantSku,
          inventory_count: totalStock
        })
        .eq('id', matched.id);
      storefrontVariantId = matched.id;
      action = 'linked_existing';
    } else {
      // No matching storefront variant — create a draft one so the CJ
      // variant isn't silently dropped, without inventing a name for an
      // existing variant it doesn't belong to.
      const variantName = cjVariant.variantNameEn || cjVariant.variantName || cjVariant.variantSku || 'Variant';
      const { data: created, error: createVariantError } = await supabase
        .from('product_variants')
        .insert({
          product_id: storefrontProduct.id,
          name: variantName,
          sku: `CJ-${cjVariant.vid}`,
          inventory_count: totalStock,
          cj_variant_id: cjVariant.vid,
          cj_variant_sku: cjVariant.variantSku,
          is_active: false, // draft — review before publishing
          sort_order: (existingVariants?.length || 0) + variantResults.length
        })
        .select()
        .single();
      if (createVariantError) throw createVariantError;
      storefrontVariantId = created.id;
      action = 'created_draft';
    }

    await supabase.from('cj_product_variants').update({ variant_id: storefrontVariantId }).eq('id', cjVariantRow.id);

    // Add CJ's variant photo as an extra gallery image (never replacing
    // existing images) if we don't already have this exact URL.
    if (cjVariant.variantImage) {
      const { data: existingImage } = await supabase
        .from('product_images')
        .select('id')
        .eq('product_id', storefrontProduct.id)
        .eq('url', cjVariant.variantImage)
        .maybeSingle();

      if (!existingImage) {
        await supabase.from('product_images').insert({
          product_id: storefrontProduct.id,
          variant_id: storefrontVariantId,
          url: cjVariant.variantImage,
          alt_text: `${storefrontProduct.name} — ${cjVariant.variantNameEn || cjVariant.variantName || ''}`.trim(),
          is_primary: false,
          sort_order: 100 + variantResults.length
        });
      }
    }

    variantResults.push({
      cjVariantId: cjVariant.vid,
      cjVariantSku: cjVariant.variantSku,
      storefrontVariantId,
      action,
      inventoryCount: totalStock
    });
  }

  return {
    cjProductId,
    storefrontProductId: storefrontProduct.id,
    storefrontSlug: storefrontProduct.slug,
    createdNewProduct,
    variantCount: cjVariants.length,
    variants: variantResults
  };
}

function slugify(input) {
  return (
    String(input || 'cj-product')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60) || 'cj-product'
  );
}
