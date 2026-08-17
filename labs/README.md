# /labs

Standalone reference builds, unrelated to the VitalBand storefront (which
lives at the repo root and is the actual ecommerce site) — none of these are
wired into Supabase, Stripe, CJ, or the storefront's product/cart logic.
They **are** included in the deployed site (see "How these get deployed"
below), each reachable at its own URL:

- `/labs/falcon-ai/` — source: `public/labs/falcon-ai/index.html`.
  Single-file HTML/CSS/JS recreation of a "Falcon AI Operations Overview"
  triptych page. No build step — static file, copied verbatim by Vite.
- `/labs/kresna-footer/` — source: `public/labs/kresna-footer/index.html`.
  Single-file HTML/CSS/JS footer component for a "Kresna" brand. No build
  step — static file, copied verbatim by Vite.
- `/labs/web3-hero/` — source: `labs/web3-hero/` (this directory). A
  separate React + TypeScript + Tailwind CSS v4 + Motion mini-project with
  its own `package.json`/`vite.config.ts` — it does not share dependencies
  with the root VitalBand project. Run `npm install && npm run dev` (or
  `npm run build`) from inside `labs/web3-hero/` to work on it directly.

## How these get deployed

`public/labs/**` is static and gets copied into `dist/labs/**` automatically
by Vite's normal build (anything in `public/` ships as-is).

`labs/web3-hero/` is a *separate* project, so `npm run build` at the repo
root (what Netlify runs) chains into `scripts/build-labs.mjs`, which
installs and builds `labs/web3-hero/` and copies its output into
`dist/labs/web3-hero/`. No changes to `netlify.toml` were needed — it's all
inside the one `npm run build` command Netlify already calls.

None of the video/logo URLs referenced in these files were verified as
live from this environment (sandboxed network access) — they're used
exactly as specified in the original request, but double check they still
resolve once you can see the live pages.
