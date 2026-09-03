-- ============================================================================
-- VitalBand — initial schema
-- Tables: products, product_variants, product_images, customers, orders,
--         order_items, reviews, testimonials, notification_events, site_settings
-- Row Level Security is enabled on every table. Public (anon) access is
-- granted ONLY to genuinely public, non-sensitive data (active products,
-- variants, images, approved reviews/testimonials, public site settings,
-- non-sensitive notification events). Customers, orders and order_items have
-- NO public policies at all — they are readable/writable only via the
-- Supabase service role key, which is used exclusively inside Netlify
-- Functions and never shipped to the browser.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- products
-- ----------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_description text,
  description text,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'EUR',
  hero_image_url text,
  rating_average numeric(2, 1) not null default 0,
  rating_count integer not null default 0,
  -- CJdropshipping linkage. Left NULL/blank until real CJ product IDs are
  -- supplied — do not invent these values.
  cj_product_id text,
  is_active boolean not null default true,
  meta_title text,
  meta_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_is_active on public.products (is_active);
create index if not exists idx_products_slug on public.products (slug);

-- ----------------------------------------------------------------------------
-- product_variants
-- ----------------------------------------------------------------------------
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  name text not null,               -- e.g. "Black", "Rose Gold", "Silver"
  sku text unique,
  hex_color text,                   -- swatch color for the variant selector
  price_cents integer check (price_cents >= 0), -- optional override of products.price_cents
  inventory_count integer not null default 0,
  -- CJdropshipping linkage. Left NULL/blank until real CJ variant IDs are
  -- supplied — do not invent these values.
  cj_variant_id text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_product_variants_product_id on public.product_variants (product_id);
create index if not exists idx_product_variants_is_active on public.product_variants (is_active);

-- ----------------------------------------------------------------------------
-- product_images
-- ----------------------------------------------------------------------------
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete cascade,
  -- Public URL — either a Supabase Storage public URL or any configurable
  -- external image URL. See supabase/README notes on the "product-images" bucket.
  url text not null,
  alt_text text not null default '',
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_images_product_id on public.product_images (product_id);
create index if not exists idx_product_images_variant_id on public.product_images (variant_id);

-- ----------------------------------------------------------------------------
-- customers (private)
-- ----------------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  first_name text,
  last_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customers_email on public.customers (email);

-- ----------------------------------------------------------------------------
-- orders (private)
-- ----------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid references public.customers (id) on delete set null,
  email text not null,

  status text not null default 'pending'
    check (status in ('pending', 'paid', 'processing', 'fulfilled', 'shipped', 'delivered', 'cancelled', 'failed')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'refunded')),
  payment_provider text not null default 'stripe',
  payment_intent_id text,
  checkout_session_id text,

  fulfillment_status text not null default 'unfulfilled'
    check (fulfillment_status in ('unfulfilled', 'submitted_to_cj', 'processing', 'shipped', 'delivered', 'failed')),
  cj_order_id text,
  tracking_number text,
  tracking_url text,
  carrier text,

  subtotal_cents integer not null default 0,
  shipping_cents integer not null default 0,
  total_cents integer not null default 0,
  currency text not null default 'EUR',

  shipping_address jsonb,
  billing_address jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_orders_order_number on public.orders (order_number);
create index if not exists idx_orders_email on public.orders (email);
create index if not exists idx_orders_customer_id on public.orders (customer_id);
create index if not exists idx_orders_checkout_session_id on public.orders (checkout_session_id);

-- ----------------------------------------------------------------------------
-- order_items (private)
-- ----------------------------------------------------------------------------
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  variant_id uuid references public.product_variants (id) on delete set null,

  product_name text not null,
  variant_name text,
  cj_product_id text,
  cj_variant_id text,

  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity > 0),
  line_total_cents integer not null check (line_total_cents >= 0),

  created_at timestamptz not null default now()
);

create index if not exists idx_order_items_order_id on public.order_items (order_id);
create index if not exists idx_order_items_product_id on public.order_items (product_id);

-- ----------------------------------------------------------------------------
-- reviews
-- Demo/test content must be flagged is_demo = true so it can never be
-- confused with genuine customer reviews. Nothing here is fabricated as if
-- it were a real person — see supabase/seed/seed.sql.
-- ----------------------------------------------------------------------------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  author_name text not null,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text not null,
  is_demo boolean not null default false,
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_reviews_product_id on public.reviews (product_id);
create index if not exists idx_reviews_is_approved on public.reviews (is_approved);

-- ----------------------------------------------------------------------------
-- testimonials
-- ----------------------------------------------------------------------------
create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  quote text not null,
  author_name text not null,
  author_title text,
  avatar_url text,
  is_demo boolean not null default false,
  is_approved boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_testimonials_is_approved on public.testimonials (is_approved);

-- ----------------------------------------------------------------------------
-- notification_events
-- Public, non-identifying "live activity" events for the notifications
-- widget in LIVE mode. Must never contain customer PII (no emails, names,
-- addresses) — only aggregate/anonymous messages.
-- ----------------------------------------------------------------------------
create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('add_to_cart', 'purchase', 'viewing', 'popular_variant')),
  product_id uuid references public.products (id) on delete cascade,
  message text not null,
  is_demo boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_notification_events_created_at on public.notification_events (created_at desc);
create index if not exists idx_notification_events_is_demo on public.notification_events (is_demo);

-- ----------------------------------------------------------------------------
-- site_settings
-- Public, non-secret configuration (hero image URL, feature flags, etc).
-- Never store API keys, tokens or other secrets in this table — those live
-- only in Netlify environment variables.
-- ----------------------------------------------------------------------------
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- updated_at triggers
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

drop trigger if exists trg_product_variants_updated_at on public.product_variants;
create trigger trg_product_variants_updated_at
  before update on public.product_variants
  for each row execute function public.set_updated_at();

drop trigger if exists trg_customers_updated_at on public.customers;
create trigger trg_customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

drop trigger if exists trg_orders_updated_at on public.orders;
create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_images enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.reviews enable row level security;
alter table public.testimonials enable row level security;
alter table public.notification_events enable row level security;
alter table public.site_settings enable row level security;

-- Public can read active products
drop policy if exists "public read active products" on public.products;
create policy "public read active products"
  on public.products for select
  to anon, authenticated
  using (is_active = true);

-- Public can read active variants
drop policy if exists "public read active variants" on public.product_variants;
create policy "public read active variants"
  on public.product_variants for select
  to anon, authenticated
  using (is_active = true);

-- Public can read all product images (images have no sensitive data)
drop policy if exists "public read product images" on public.product_images;
create policy "public read product images"
  on public.product_images for select
  to anon, authenticated
  using (true);

-- Public can read approved reviews
drop policy if exists "public read approved reviews" on public.reviews;
create policy "public read approved reviews"
  on public.reviews for select
  to anon, authenticated
  using (is_approved = true);

-- Public can read approved testimonials
drop policy if exists "public read approved testimonials" on public.testimonials;
create policy "public read approved testimonials"
  on public.testimonials for select
  to anon, authenticated
  using (is_approved = true);

-- Public can read notification events (aggregate/anonymous only by design)
drop policy if exists "public read notification events" on public.notification_events;
create policy "public read notification events"
  on public.notification_events for select
  to anon, authenticated
  using (true);

-- Public can read site settings (non-secret config only, by design)
drop policy if exists "public read site settings" on public.site_settings;
create policy "public read site settings"
  on public.site_settings for select
  to anon, authenticated
  using (true);

-- customers, orders, order_items intentionally have NO policies for
-- anon/authenticated roles. RLS is enabled with zero matching policies,
-- so all access is denied by default for those roles. Only the Supabase
-- service role key (used exclusively in Netlify Functions, server-side)
-- bypasses RLS and can read/write these tables.
