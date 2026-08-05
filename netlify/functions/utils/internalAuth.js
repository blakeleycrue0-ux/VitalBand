// The cj-* functions wrap CJdropshipping's private API. The storefront
// itself never calls them directly (products/orders flow through Supabase;
// stripe-webhook.js calls the CJ client module directly, in-process, after
// verifying payment). These HTTP endpoints exist for admin/back-office
// tooling (e.g. a future admin dashboard retrying fulfillment, or manual
// CJ product sync) and must not be left open to the public internet, since
// they can trigger real orders/costs on your CJ account.
//
// Guarded by a shared secret header, not by Netlify's public/private
// distinction (Netlify Functions are public HTTP endpoints by default).
export function isAuthorizedInternalRequest(event) {
  const expected = process.env.INTERNAL_FUNCTIONS_KEY;
  if (!expected) return false; // fail closed if not configured
  const provided = event.headers['x-internal-key'] || event.headers['X-Internal-Key'];
  return provided === expected;
}
