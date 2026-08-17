# /labs

Standalone reference builds, unrelated to the VitalBand storefront (which
lives at the repo root and is what actually deploys to
`vitalband0.netlify.app`). Kept here, isolated, at the user's explicit
request — none of these are wired into the ecommerce site, Supabase, or the
Netlify Functions.

- **falcon-ai/** — single-file HTML/CSS/JS recreation of a "Falcon AI
  Operations Overview" triptych page. No build step: open `index.html`
  directly, or serve the folder as static files.
- **kresna-footer/** — single-file HTML/CSS/JS footer component for a
  "Kresna" brand. No build step: open `index.html` directly.
- **web3-hero/** — a separate React + TypeScript + Tailwind CSS v4 + Motion
  mini-project (its own `package.json`). Run `npm install && npm run dev`
  (or `npm run build`) from inside `labs/web3-hero/` — it does not share
  dependencies with the root VitalBand project.

None of the video/logo URLs referenced in these files were verified as
live from this environment (sandboxed network access) — they're used
exactly as specified, but check they still resolve before treating this as
production-ready.
