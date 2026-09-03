-- ============================================================================
-- CJdropshipping supplier data layer.
--
-- Design goal: importing/refreshing a product from CJ must NEVER overwrite
-- the customer-facing storefront branding (name, price, description, images)
-- that lives in products/product_variants/product_images. CJ's raw data —
-- including CJ's sell price to us, which is cost information that must never
-- reach a customer — is mirrored into these two new tables instead, which
-- have RLS enabled with NO public policies (same pattern as customers/orders
-- — reachable only via the Supabase service role key inside Netlify
-- Functions). The storefront tables are only ever linked to this raw data by
-- id (product_id / variant_id / cj_product_id / cj_variant_id) — never
-- clobbered wholesale on re-sync. See netlify/functions/cj-import-product.js.
-- ============================================================================

-- The original schema had cj_variant_id but not the CJ variant SKU
-- specifically requested for import tracking.
alter table public.product_variants add column if not exists cj_variant_sku text;

create table if not exists public.cj_products (
  id uuid primary key default gen_random_uuid(),
  cj_product_id text not null unique,
  -- The storefront product this CJ listing is linked to, if any. Nullable:
  -- a raw CJ snapshot can exist before any storefront product references it.
  product_id uuid references public.products (id) on delete set null,

  raw_name text,
  raw_name_en text,
  raw_description text,
  category_id text,
  category_name text,
  product_sku text,
  -- CJ's sell price to us (i.e. our cost). Never exposed to anon/authenticated
  -- — this table has no public RLS policy at all.
  cj_sell_price_cents integer,
  raw_images jsonb not null default '[]'::jsonb,
  raw_response jsonb,

  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cj_products_product_id on public.cj_products (product_id);

create table if not exists public.cj_product_variants (
  id uuid primary key default gen_random_uuid(),
  cj_product_row_id uuid not null references public.cj_products (id) on delete cascade,
  cj_variant_id text not null unique,
  -- The storefront variant this CJ variant is linked to, if any.
  variant_id uuid references public.product_variants (id) on delete set null,

  cj_variant_sku text,
  raw_variant_name text,
  raw_variant_name_en text,
  raw_variant_property text,
  -- CJ's sell price to us for this variant (our cost). Never public.
  cj_sell_price_cents integer,
  image_url text,
  inventory_count integer not null default 0,
  warehouse_info jsonb not null default '[]'::jsonb,
  raw_response jsonb,

  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cj_product_variants_cj_product_row_id on public.cj_product_variants (cj_product_row_id);
create index if not exists idx_cj_product_variants_variant_id on public.cj_product_variants (variant_id);

drop trigger if exists trg_cj_products_updated_at on public.cj_products;
create trigger trg_cj_products_updated_at
  before update on public.cj_products
  for each row execute function public.set_updated_at();

drop trigger if exists trg_cj_product_variants_updated_at on public.cj_product_variants;
create trigger trg_cj_product_variants_updated_at
  before update on public.cj_product_variants
  for each row execute function public.set_updated_at();

alter table public.cj_products enable row level security;
alter table public.cj_product_variants enable row level security;
-- Intentionally zero policies for anon/authenticated — same pattern as
-- customers/orders. Only the service role (Netlify Functions) can read/write.
