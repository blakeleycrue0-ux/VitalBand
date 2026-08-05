-- ============================================================================
-- VitalBand — seed data (development / initial launch content)
--
-- IMPORTANT — CJ Dropshipping IDs:
-- cj_product_id / cj_variant_id are intentionally left NULL below. Do not
-- invent these values. Once you have the real product listed in your CJ
-- account, update these two columns with the real IDs, e.g.:
--
--   update public.product_variants set cj_variant_id = '2408...' where sku = 'VB-SB-BLACK';
--   update public.products set cj_product_id = '1234...' where slug = 'smart-bracelet';
--
-- IMPORTANT — reviews/testimonials:
-- All rows below are seeded with is_demo = true. They are placeholder demo
-- content for development, clearly flagged as such (the frontend renders a
-- "Demo" badge on anything with is_demo = true). They use first-name-only
-- placeholders, not fabricated full identities, photos or locations. Replace
-- with real, imported reviews (is_demo = false) once available.
-- ============================================================================

insert into public.products (slug, name, short_description, description, price_cents, currency, hero_image_url, rating_average, rating_count, cj_product_id, is_active, meta_title, meta_description)
values (
  'smart-bracelet',
  'Smart Watch Smart Bracelet Sports Heart Rate',
  'Track heart rate, activity, sleep and more in a sleek everyday bracelet.',
  'A minimal, all-day fitness bracelet built for real life. Continuous heart-rate tracking, sleep analysis, activity monitoring and smart notifications — in a lightweight band that looks as good in a meeting as it does on a run.',
  4900,
  'EUR',
  'https://placehold.co/1600x2000/0a0a0a/f5f5f0?text=VitalBand',
  4.9,
  2400,
  null, -- configure with real CJ product ID before going live
  true,
  'VitalBand Smart Bracelet — Heart Rate & Activity Tracker',
  'Track your heart rate, activity, sleep and more with the VitalBand Smart Bracelet. Premium design, all-day battery, water resistant.'
)
on conflict (slug) do nothing;

-- Variants -------------------------------------------------------------------
insert into public.product_variants (product_id, name, sku, hex_color, inventory_count, cj_variant_id, is_active, sort_order)
select id, v.name, v.sku, v.hex_color, v.inventory_count, null, true, v.sort_order
from public.products p
cross join (
  values
    ('Black', 'VB-SB-BLACK', '#111111', 250, 0),
    ('Rose Gold', 'VB-SB-ROSEGOLD', '#b76e79', 180, 1),
    ('Silver', 'VB-SB-SILVER', '#c7c9cc', 200, 2)
) as v(name, sku, hex_color, inventory_count, sort_order)
where p.slug = 'smart-bracelet'
on conflict (sku) do nothing;

-- Images -----------------------------------------------------------------
-- Placeholder images (placehold.co) so the gallery renders during development.
-- Replace with real product photography uploaded to the "product-images"
-- Supabase Storage bucket, or any configurable public image URL.
insert into public.product_images (product_id, variant_id, url, alt_text, is_primary, sort_order)
select p.id, null, img.url, img.alt_text, img.is_primary, img.sort_order
from public.products p
cross join (
  values
    ('https://placehold.co/1200x1500/0a0a0a/f5f5f0?text=VitalBand+1', 'VitalBand smart bracelet, front view', true, 0),
    ('https://placehold.co/1200x1500/111111/f5f5f0?text=VitalBand+2', 'VitalBand smart bracelet, worn on wrist', false, 1),
    ('https://placehold.co/1200x1500/1a1a1a/f5f5f0?text=VitalBand+3', 'VitalBand smart bracelet, side profile', false, 2),
    ('https://placehold.co/1200x1500/0a0a0a/f5f5f0?text=VitalBand+4', 'VitalBand smart bracelet, display close-up', false, 3),
    ('https://placehold.co/1200x1500/141414/f5f5f0?text=VitalBand+5', 'VitalBand smart bracelet, heart rate sensor detail', false, 4),
    ('https://placehold.co/1200x1500/0a0a0a/f5f5f0?text=VitalBand+6', 'VitalBand smart bracelet, strap detail', false, 5),
    ('https://placehold.co/1200x1500/111111/f5f5f0?text=VitalBand+7', 'VitalBand smart bracelet, lifestyle, running', false, 6),
    ('https://placehold.co/1200x1500/1a1a1a/f5f5f0?text=VitalBand+8', 'VitalBand smart bracelet, packaging', false, 7)
) as img(url, alt_text, is_primary, sort_order)
where p.slug = 'smart-bracelet';

-- Reviews (demo/development content — see notice above) -----------------------
insert into public.reviews (product_id, author_name, rating, title, body, is_demo, is_approved)
select p.id, r.author_name, r.rating, r.title, r.body, true, true
from public.products p
cross join (
  values
    ('Alex', 5, 'Wear it every day', 'Sample/demo review for development. Comfortable band, easy to read the display outdoors, and the battery lasts as advertised.'),
    ('Jordan', 5, 'Good for training', 'Sample/demo review for development. Heart rate readings during runs have tracked closely with my chest strap.'),
    ('Sam', 4, 'Solid everyday tracker', 'Sample/demo review for development. Sleek enough for the office, tough enough for the gym. Would like more strap color options.'),
    ('Riley', 5, 'Clean design', 'Sample/demo review for development. Doesn''t look like a typical fitness tracker — much closer to a minimal watch.')
) as r(author_name, rating, title, body)
where p.slug = 'smart-bracelet';

-- Testimonials (demo/development content — see notice above) ------------------
insert into public.testimonials (quote, author_name, author_title, is_demo, is_approved, sort_order)
values
  ('Sample/demo testimonial for development. The bracelet quietly does its job — I forget I''m wearing it until I check my stats.', 'Demo Testimonial', 'Placeholder — replace with real testimonial', true, true, 0),
  ('Sample/demo testimonial for development. Battery life is the standout feature compared to what I used before.', 'Demo Testimonial', 'Placeholder — replace with real testimonial', true, true, 1),
  ('Sample/demo testimonial for development. Setup took minutes and the app pairing was painless.', 'Demo Testimonial', 'Placeholder — replace with real testimonial', true, true, 2)
on conflict do nothing;

-- Site settings ----------------------------------------------------------
insert into public.site_settings (key, value)
values
  ('hero', '{"image_url": "https://placehold.co/1600x2000/0a0a0a/f5f5f0?text=VitalBand", "image_alt": "VitalBand smart bracelet hero image"}'),
  ('notifications', '{"enabled": true, "mode": "demo", "min_interval_seconds": 8, "max_interval_seconds": 15, "visible_seconds": 5}'),
  ('brand', '{"name": "VitalBand", "accent_color": "#c6ff3d"}')
on conflict (key) do update set value = excluded.value, updated_at = now();
