import { getStripe } from './utils/stripeClient.js';
import { getSupabaseAdmin } from './utils/supabaseAdmin.js';
import { json, safeError } from './utils/response.js';
import { generateOrderNumber } from './utils/orderNumber.js';

const MAX_QUANTITY_PER_ITEM = 10;
const MAX_ITEMS = 20;

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { message: 'Method not allowed' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { message: 'Invalid request body.' });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0 || items.length > MAX_ITEMS) {
    return json(400, { message: 'Your cart looks empty. Add an item before checking out.' });
  }

  for (const item of items) {
    if (!item.variantId || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY_PER_ITEM) {
      return json(400, { message: 'One of the items in your cart is invalid. Please refresh and try again.' });
    }
  }

  const origin = event.headers.origin || `https://${event.headers.host}`;
  const successUrl = isSafeReturnUrl(body.successUrl, origin) ? body.successUrl : `${origin}/success.html`;
  const cancelUrl = isSafeReturnUrl(body.cancelUrl, origin) ? body.cancelUrl : `${origin}/cancel.html`;

  try {
    const supabase = getSupabaseAdmin();
    const variantIds = items.map((i) => i.variantId);

    // Authoritative price + stock + product data comes from Supabase, never
    // from the client — a shopper cannot influence what they're charged.
    const { data: variants, error } = await supabase
      .from('product_variants')
      .select('id, name, price_cents, inventory_count, is_active, cj_variant_id, product_id, products(id, name, price_cents, currency, is_active, hero_image_url, cj_product_id)')
      .in('id', variantIds);

    if (error) throw error;

    const byId = new Map((variants || []).map((v) => [v.id, v]));
    const lineItems = [];
    const orderItemsMeta = [];

    for (const item of items) {
      const variant = byId.get(item.variantId);
      if (!variant || !variant.is_active || !variant.products?.is_active) {
        return json(409, { message: 'One of the items in your cart is no longer available.' });
      }
      if (variant.inventory_count < item.quantity) {
        return json(409, {
          message: `Only ${variant.inventory_count} unit(s) of ${variant.products.name} — ${variant.name} left in stock.`
        });
      }

      const unitAmount = variant.price_cents ?? variant.products.price_cents;
      const currency = (variant.products.currency || 'EUR').toLowerCase();

      lineItems.push({
        quantity: item.quantity,
        price_data: {
          currency,
          unit_amount: unitAmount,
          product_data: {
            name: `${variant.products.name} — ${variant.name}`,
            images: variant.products.hero_image_url ? [variant.products.hero_image_url] : []
          }
        }
      });

      orderItemsMeta.push({
        productId: variant.product_id,
        variantId: variant.id,
        productName: variant.products.name,
        variantName: variant.name,
        unitPriceCents: unitAmount,
        quantity: item.quantity,
        cjProductId: variant.products.cj_product_id,
        cjVariantId: variant.cj_variant_id
      });
    }

    // Pre-create the order in Supabase as "pending" — it only becomes "paid"
    // once stripe-webhook.js verifies the payment server-side. Nothing here
    // is treated as a real, fulfillable order yet; storing it now (instead
    // of stuffing full cart contents into Stripe metadata, which has a
    // 500-character-per-key limit) just gives the webhook a durable place
    // to write the confirmed status back to, keyed by checkout session id.
    const subtotalCents = orderItemsMeta.reduce((sum, i) => sum + i.unitPriceCents * i.quantity, 0);
    const orderNumber = generateOrderNumber();

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        email: 'pending@checkout', // overwritten by stripe-webhook.js from the completed session
        status: 'pending',
        payment_status: 'pending',
        subtotal_cents: subtotalCents,
        total_cents: subtotalCents,
        currency: (variants[0]?.products?.currency || 'EUR')
      })
      .select()
      .single();

    if (orderError) throw orderError;

    const { error: itemsError } = await supabase.from('order_items').insert(
      orderItemsMeta.map((i) => ({
        order_id: order.id,
        product_id: i.productId,
        variant_id: i.variantId,
        product_name: i.productName,
        variant_name: i.variantName,
        unit_price_cents: i.unitPriceCents,
        quantity: i.quantity,
        line_total_cents: i.unitPriceCents * i.quantity,
        cj_product_id: i.cjProductId,
        cj_variant_id: i.cjVariantId
      }))
    );

    if (itemsError) throw itemsError;

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: lineItems,
      success_url: `${successUrl}${successUrl.includes('?') ? '&' : '?'}session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      shipping_address_collection: {
        allowed_countries: ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'US', 'CA']
      },
      phone_number_collection: { enabled: true },
      metadata: {
        order_id: order.id,
        order_number: orderNumber
      }
    });

    await supabase.from('orders').update({ checkout_session_id: session.id }).eq('id', order.id);

    return json(200, { url: session.url });
  } catch (err) {
    return safeError('create-checkout', err, 502, 'Checkout is temporarily unavailable. Please try again shortly.');
  }
}

function isSafeReturnUrl(url, origin) {
  if (typeof url !== 'string') return false;
  try {
    return new URL(url).origin === new URL(origin).origin;
  } catch {
    return false;
  }
}
