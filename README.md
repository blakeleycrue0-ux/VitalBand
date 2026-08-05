# VitalBand

A standalone ecommerce storefront for the VitalBand Smart Bracelet — built on
GitHub + Netlify + Supabase + Netlify Functions, with CJdropshipping as the
fulfillment backend. No Shopify, no page builder — plain HTML/CSS/JS via
Vite, with all sensitive operations (payments, supplier API, order data)
kept server-side in Netlify Functions.

```
GitHub → Netlify → Frontend + Netlify Functions → Supabase → CJdropshipping
Customer → Website → Cart → Checkout → Stripe → Netlify Function
                                          ↓
                                  Stripe webhook (payment verified)
                                          ↓
                                    Supabase order
                                          ↓
                                   CJdropshipping order
                                          ↓
                              Fulfillment → Tracking → Supabase → Customer
```

---

## 1. Project structure

```
/index.html            Homepage
/product.html           Product detail page
/success.html           Post-checkout confirmation
/cancel.html             Checkout cancelled
/track.html               Order tracking
/404.html                   Not found

/src
  /css                        Design system + page styles
  /js                          All client-side logic (cart, gallery, search,
                                 notifications, checkout trigger, Supabase reads)

/public                    Static files served as-is (robots.txt, sitemap.xml)

/netlify
  /functions
    create-checkout.js       Creates a Stripe Checkout Session (+ pending Supabase order)
    stripe-webhook.js         Verifies payment, confirms the order, triggers CJ fulfillment
    order-lookup.js            Customer order tracking (order number + email)
    order-by-session.js         Success-page order lookup by Stripe session id
    cj-product.js                 }
    cj-inventory.js                } Internal/admin CJdropshipping proxies —
    cj-create-order.js              } see "CJdropshipping configuration" below
    cj-order-status.js              }
    cj-tracking.js                }
    /utils                     Shared server-side helpers (Supabase admin client,
                                 Stripe client, CJ API client, response helpers)

/supabase
  /migrations               SQL schema, RLS policies, storage bucket
  /seed                      Seed data (the Smart Bracelet product + demo content)

.env.example               All environment variables, public vs private
netlify.toml                 Build, functions, redirects, security headers
vite.config.js
package.json
```

---

## 2. Local setup

```bash
npm install
cp .env.example .env       # fill in at least the Supabase values to see real data
npm run dev                 # http://localhost:5173
npm run build                # production build to /dist
npm run preview               # preview the production build locally
```

Netlify Functions are not run by `vite dev` — to test them locally, install
the [Netlify CLI](https://docs.netlify.com/cli/get-started/) and run
`netlify dev` instead, which proxies `/.netlify/functions/*` alongside Vite.

Without any environment variables set, the site still runs: pages render
with static fallback copy/prices, cart/search/menu/notifications all work
(they're pure client-side), and Supabase-backed sections (live product data,
reviews, testimonials) show a friendly "not configured" state instead of
crashing.

---

## 3. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Run the SQL in `supabase/migrations/` **in order** (SQL editor, or
   `supabase db push` / `supabase migration up` if you're using the Supabase
   CLI locally):
   - `0001_init.sql` — tables, indexes, foreign keys, Row Level Security policies
   - `0002_storage.sql` — public `product-images` storage bucket
   - `0003_inventory_rpc.sql` — atomic inventory decrement used by the Stripe webhook
3. Run `supabase/seed/seed.sql` to load the Smart Bracelet product, its 3
   variants (Black / Rose Gold / Silver), real product photography (see
   §Product images below), and clearly-flagged demo reviews/testimonials.
4. Copy your Project URL + anon public key into `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY`, and the same URL + **service role** key into
   `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.

### Data model

`products` → `product_variants` → `product_images`, plus `customers`,
`orders` → `order_items`, `reviews`, `testimonials`, `notification_events`,
`site_settings`. Every table has RLS **enabled**. Public policies exist only
for genuinely public data (active products/variants, all images, approved
reviews/testimonials, site settings, activity notifications). **`customers`,
`orders` and `order_items` have zero public policies** — they are only
reachable through the service role key used inside Netlify Functions, never
from the browser.

### Product data / CJdropshipping IDs

The seed data intentionally leaves `products.cj_product_id` and
`product_variants.cj_variant_id` as `NULL`. **You still need to provide the
real CJdropshipping product/variant IDs** once you've sourced/listed this
product in your CJ account:

```sql
update public.products set cj_product_id = '<real CJ product id>' where slug = 'smart-bracelet';
update public.product_variants set cj_variant_id = '<real CJ variant id>' where sku = 'VB-SB-BLACK';
-- ...repeat for VB-SB-ROSEGOLD, VB-SB-SILVER
```

Orders with line items missing a `cj_variant_id` are deliberately **not**
submitted to CJ automatically (the Stripe webhook logs and skips CJ
submission, marking `fulfillment_status = 'failed'` while the payment itself
stays confirmed) — see `netlify/functions/utils/fulfillment.js`.

### Product images

Real product photography ships as static files in `public/images/` (so
they deploy with the site and work at any domain with no Supabase Storage
setup required):
- `bracelet-silver-studio.png` — generic/primary studio shot (also used for
  the Silver variant)
- `bracelet-black-studio.png` — Black variant studio shot
- `bracelet-lifestyle-running.png` — lifestyle shot, also used as the
  homepage hero image

`product_images.url` points at these with root-relative paths
(`/images/bracelet-silver-studio.png`), which resolve correctly regardless
of your Netlify domain. **There is no real photo yet for Rose Gold** — it
intentionally falls back to the generic (non-variant-specific) images
rather than showing a fabricated one. Add more angles (display close-up,
strap detail, packaging, a real Rose Gold shot) by dropping them in
`public/images/` and inserting a row into `product_images` — or switch to
Supabase Storage's `product-images` bucket instead if you'd rather manage
photos from the dashboard without a redeploy.

The product page loads images dynamically from `product_images`, so no code
changes are needed to swap/add photos — only new `product_images` rows.

---

## 4. Payment setup (Stripe)

1. Create a [Stripe](https://stripe.com) account, get your API keys from the Dashboard.
2. Set `STRIPE_SECRET_KEY` and `VITE_STRIPE_PUBLISHABLE_KEY`.
3. Add a webhook endpoint in the Stripe Dashboard pointing to:
   `https://<your-site>.netlify.app/.netlify/functions/stripe-webhook`
   listening for `checkout.session.completed` (and optionally
   `checkout.session.async_payment_succeeded` /
   `checkout.session.async_payment_failed`).
4. Copy the webhook's signing secret into `STRIPE_WEBHOOK_SECRET`.

No card form exists anywhere in this codebase — `create-checkout.js` creates
a Stripe-hosted Checkout Session server-side (price/stock re-validated
against Supabase, never trusting the browser) and the browser is redirected
to Stripe's own page. The order is written to Supabase as `pending` *before*
redirecting, and is only marked `paid` — and only then pushed to CJ for
fulfillment — inside `stripe-webhook.js`, after Stripe's signature is
verified. Reaching `/success.html` does nothing by itself; that page just
polls Supabase for whatever the webhook has already confirmed.

---

## 5. CJdropshipping configuration

**Read this before enabling real orders.** CJ's documentation site blocks
automated fetches, so the client in `netlify/functions/utils/cjClient.js`
was built from what's publicly confirmed (via CJ's own search-indexed docs)
as of this build:

- Base URL: `https://developers.cjdropshipping.com/api2.0/v1`
- Auth: `POST /authentication/getAccessToken`, then `CJ-Access-Token: <token>`
  header on every other request
- Confirmed endpoints: `product/list`, `product/query`,
  `product/variant/query`, `product/comments`, `logistic/trackInfo`
- Rate limit: 1 request/second

The **order-creation request/response shape** (the "Shopping" module) could
not be independently re-verified from this environment — `createCjOrder()`
in `cjClient.js` isolates a best-guess shape in one place with an inline
comment. **Before going live**, log into your CJ account, open
`developers.cjdropshipping.com/en/api/api2/` in a real browser, and confirm
the `getAccessToken` and order-creation payloads match what's implemented,
adjusting `cjClient.js` if not.

Set:
```
CJ_EMAIL=            # your CJ account email
CJ_API_KEY=           # from CJ Personal Center → API → Get API Key
```

### Why the `cj-*.js` functions require a key

`cj-product.js`, `cj-inventory.js`, `cj-create-order.js`,
`cj-order-status.js` and `cj-tracking.js` are **not** called by the
storefront — the browser never talks to CJ directly, and the automatic
checkout flow calls the CJ client in-process from `stripe-webhook.js`. These
five HTTP endpoints exist for future admin/back-office use (manual product
sync, retrying a failed fulfillment, refreshing tracking) and are guarded by
an `x-internal-key` header checked against `INTERNAL_FUNCTIONS_KEY` — set
that to a long random value (`openssl rand -hex 32`) and keep it private.

---

## 6. Netlify setup

1. **Connect your GitHub repository** to Netlify (New site from Git).
2. Netlify reads `netlify.toml` automatically: build command `npm run
   build`, publish directory `dist`, functions directory
   `netlify/functions`.
3. **Configure environment variables** (Site configuration → Environment
   variables) — see `.env.example` for the full list, split into public
   (`VITE_*`, safe in the browser bundle) and private (server-only, read
   only inside `netlify/functions/**`).
4. **Connect Supabase** — set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
   (public) and `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (private).
5. **Configure CJdropshipping** — set `CJ_EMAIL` / `CJ_API_KEY` /
   `INTERNAL_FUNCTIONS_KEY`.
6. **Configure the payment provider** — set `STRIPE_SECRET_KEY` /
   `VITE_STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET`.
7. **Deploy.** Every push to the connected branch triggers a build; Netlify
   Functions deploy automatically alongside the static site.

---

## 7. Environment variables

See `.env.example` for the authoritative list. Summary:

**Public** (`VITE_*` — bundled into the browser JS, must never contain a secret):
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_STRIPE_PUBLISHABLE_KEY`,
`VITE_NOTIFICATIONS_ENABLED`, `VITE_NOTIFICATIONS_MODE`.

**Private** (server-only, read exclusively inside `netlify/functions/**`):
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `CJ_EMAIL`, `CJ_API_KEY`, `INTERNAL_FUNCTIONS_KEY`,
`SITE_CURRENCY`.

The anon key is safe to expose by design — Supabase Row Level Security (not
secrecy of the key) is what protects the data; see `supabase/migrations/0001_init.sql`.

---

## 8. Live notifications (demo vs. live mode)

Controlled by `VITE_NOTIFICATIONS_ENABLED` / `VITE_NOTIFICATIONS_MODE`
(`demo` or `live`), implemented in `src/js/notifications.js`:

- **Demo mode**: generic, simulated activity messages generated entirely in
  the browser (e.g. "Someone just added the Smart Bracelet to their cart.").
  Nothing here claims to be a specific real event.
- **Live mode**: reads only real rows from the `notification_events` table
  (`is_demo = false`), inserted server-side — currently, once, by
  `stripe-webhook.js` after a genuine confirmed purchase (no customer PII in
  the message). Extend this by inserting more rows from other server-side
  events as needed.

---

## 9. What's demo/placeholder content right now

- **Reviews & testimonials**: seeded with `is_demo = true` and rendered with
  a visible "Demo" badge — see `supabase/seed/seed.sql`. Replace with real,
  imported reviews (`is_demo = false`) as they come in.
- **Product images**: real photography for the generic/Silver studio shot,
  Black variant, and a lifestyle shot (`public/images/`). **Rose Gold and
  extra angles (display close-up, strap detail, packaging) are still
  missing** — those slots fall back to the generic images rather than
  showing anything fabricated.
- **`cj_product_id` / `cj_variant_id`**: left blank — see §3.
- **Product structured data** (JSON-LD on `product.html`/`index.html`)
  intentionally has **no** `aggregateRating`/`review` schema, so demo review
  content is never presented to search engines as genuine.

---

## 10. Verification performed

- `npm install`, `npm run dev`, `npm run build` all succeed with no errors.
- Every route (`/`, `/product.html`, `/success.html`, `/cancel.html`,
  `/track.html`, `/404.html`) manually exercised in a headless browser at
  desktop (1440px) and mobile (390px) widths — nav, cart drawer, search
  overlay, mobile menu, FAQ accordion, product gallery/variant selector all
  confirmed working, with no console errors.
- Confirmed the production bundle (`dist/`) contains no Supabase service
  role key, Stripe secret key, CJ credentials, or `process.env` references —
  only `VITE_*` public values are ever in client-side code.
- Every Netlify Function imports and invokes cleanly and fails **safely**
  (friendly JSON error, correct status code, no stack trace) when its
  required credentials aren't set — verified by invoking each handler
  directly with mock events.
- What could **not** be verified without live credentials (clearly marked
  "requires credentials" — implemented, not tested end-to-end): an actual
  Stripe checkout + webhook round trip, a real CJdropshipping
  authentication/order-creation call, and Supabase reads/writes against a
  live project.

---

## 11. What you still need to provide

1. A Supabase project — run the migrations + seed, then paste its URL/keys in.
2. Real CJdropshipping product + variant IDs for the Smart Bracelet, once
   listed in your CJ account (`cj_product_id`, `cj_variant_id`).
3. A CJ account API key (`CJ_EMAIL` / `CJ_API_KEY`), and 10 minutes to
   confirm the order-creation request shape against CJ's current docs in a
   real browser (see §5).
4. A Stripe account (secret key, publishable key, webhook secret).
5. A real Rose Gold product photo, plus more angles (display close-up,
   strap detail, packaging) — silver/black studio shots and a lifestyle
   photo are already in.
6. Real customer reviews/testimonials, once available, to replace/supplement
   the flagged demo content.
7. A domain connected in Netlify, so `public/sitemap.xml` can be updated
   with the real URLs (currently placeholders).
