-- ============================================================================
-- VitalBand — Supabase Storage bucket for product images
-- Creates a public "product-images" bucket. Public read is appropriate here:
-- product photography is meant to be publicly visible on the storefront.
-- Only service-role (Netlify Functions / dashboard) can upload or modify.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Public can read files in the product-images bucket
drop policy if exists "public read product-images bucket" on storage.objects;
create policy "public read product-images bucket"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

-- No insert/update/delete policies are granted to anon/authenticated:
-- uploads and management happen via the service role key (Supabase
-- dashboard or an authenticated admin tool), never from the storefront.
