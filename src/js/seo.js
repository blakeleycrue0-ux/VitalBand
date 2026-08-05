// Sets the canonical <link> at runtime using the real deployed origin.
// Kept out of the static HTML so Vite's multi-page build doesn't resolve a
// relative link[href] pointing at a sibling page (e.g. /track.html) as a
// build asset and emit a duplicate copy of that page into dist/assets.
export function setCanonical(pathAndQuery) {
  const el = document.getElementById('canonical-link');
  if (!el) return;
  el.setAttribute('href', `${window.location.origin}${pathAndQuery}`);
}
