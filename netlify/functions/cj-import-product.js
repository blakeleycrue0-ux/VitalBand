import { json, safeError } from './utils/response.js';
import { isAuthorizedInternalRequest } from './utils/internalAuth.js';
import { importCjProduct } from './utils/cjImport.js';

// Imports/refreshes one CJ product into Supabase. Never overwrites
// storefront branding (name/price/description/images you've set) — see
// netlify/functions/utils/cjImport.js for exactly what is and isn't
// touched. Response never includes CJ's cost/sell price.
export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { message: 'Method not allowed' });
  }
  if (!isAuthorizedInternalRequest(event)) {
    return json(401, { message: 'Unauthorized' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { message: 'Invalid request body' });
  }

  if (!body.cjProductId) {
    return json(400, { message: 'cjProductId is required' });
  }

  try {
    const result = await importCjProduct(body.cjProductId, { targetSlug: body.targetSlug });
    return json(200, { success: true, ...result });
  } catch (err) {
    return safeError('cj-import-product', err, 502, err.message?.startsWith('CJ') ? err.message : 'Unable to import this product from CJ right now.');
  }
}
