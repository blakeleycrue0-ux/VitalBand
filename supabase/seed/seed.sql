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
  '/images/bracelet-lifestyle-running.png',
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
-- Real product photography (shipped as static files in /public/images — see
-- public/images/bracelet-*.png). Only 3 angles are available so far: a
-- generic/silver studio shot, a black-variant studio shot, and a lifestyle
-- running shot. There is no real photo yet for Rose Gold — it intentionally
-- falls back to the generic (variant_id null) images below rather than
-- showing a fabricated Rose Gold photo. Add more angles (display close-up,
-- strap detail, packaging, a real Rose Gold shot) as they become available.
insert into public.product_images (product_id, variant_id, url, alt_text, is_primary, sort_order)
select p.id, null, '/images/bracelet-silver-studio.png', 'VitalBand smart bracelet, silver/white woven band, studio shot', true, 0
from public.products p
where p.slug = 'smart-bracelet';

insert into public.product_images (product_id, variant_id, url, alt_text, is_primary, sort_order)
select p.id, null, '/images/bracelet-lifestyle-running.png', 'VitalBand smart bracelet worn while running outdoors', false, 1
from public.products p
where p.slug = 'smart-bracelet';

insert into public.product_images (product_id, variant_id, url, alt_text, is_primary, sort_order)
select p.id, v.id, '/images/bracelet-black-studio.png', 'VitalBand smart bracelet, black woven band, studio shot', false, 2
from public.products p
join public.product_variants v on v.product_id = p.id and v.sku = 'VB-SB-BLACK'
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
    ('Riley', 5, 'Clean design', 'Sample/demo review for development. Doesn''t look like a typical fitness tracker — much closer to a minimal watch.'),
    ('Morgan', 5, 'Great gift', 'Sample/demo review for development. Bought one for my partner too — packaging felt premium and setup was quick.'),
    ('Casey', 4, 'Comfortable for sleep tracking', 'Sample/demo review for development. Light enough to wear overnight, and the sleep summary in the app is easy to read.'),
    ('Taylor', 5, 'Battery really does last', 'Sample/demo review for development. I charge it once a week and that''s genuinely enough for my routine.'),
    ('Jamie', 3, 'Good, with one caveat', 'Sample/demo review for development. Works well day to day, but I wish the strap came in one more length option.')
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
  ('hero', '{"image_url": "/images/bracelet-lifestyle-running.png", "image_alt": "VitalBand smart bracelet worn while running outdoors"}'),
  ('notifications', '{"enabled": true, "mode": "demo", "min_interval_seconds": 8, "max_interval_seconds": 15, "visible_seconds": 5}'),
  ('brand', '{"name": "VitalBand", "accent_color": "#c6ff3d"}'),
  -- Promo bar: OFF by default (enabled: false) with no real end_at, so
  -- nothing false is ever shown to a customer. Turn it on only when you have
  -- a genuine time-limited offer, with its real end date/time — the
  -- countdown is a real timer against `end_at`, not a fake one that resets.
  -- Example to activate a real 48-hour promo:
  --   update public.site_settings set value = jsonb_build_object(
  --     'enabled', true,
  --     'message', 'Free shipping this week —',
  --     'code', 'SHIP49',
  --     'end_at', (now() + interval '48 hours')
  --   ) where key = 'promo';
  ('promo', '{"enabled": false, "message": "", "code": null, "end_at": null}')
on conflict (key) do update set value = excluded.value, updated_at = now();
