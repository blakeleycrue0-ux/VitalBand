import { getVariantInventory } from './utils/cjClient.js';
import { json, safeError } from './utils/response.js';
import { isAuthorizedInternalRequest } from './utils/internalAuth.js';

// Internal/admin endpoint — proxies CJdropshipping's product/stock/queryByVid
// so stock levels can be synced into Supabase (product_variants.inventory_count).
// Not called by the storefront directly.
export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return json(405, { message: 'Method not allowed' });
  }
  if (!isAuthorizedInternalRequest(event)) {
    return json(401, { message: 'Unauthorized' });
  }

  const cjVariantId = event.queryStringParameters?.cjVariantId;
  if (!cjVariantId) {
    return json(400, { message: 'cjVariantId is required' });
  }

  try {
    const data = await getVariantInventory(cjVariantId);
    return json(200, data);
  } catch (err) {
    return safeError('cj-inventory', err, 502, 'Unable to reach the supplier inventory feed right now.');
  }
}
