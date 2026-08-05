import { getProduct } from './utils/cjClient.js';
import { json, safeError } from './utils/response.js';
import { isAuthorizedInternalRequest } from './utils/internalAuth.js';

// Internal/admin endpoint — proxies CJdropshipping's product/query. Not
// called by the storefront (see utils/internalAuth.js for why).
export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return json(405, { message: 'Method not allowed' });
  }
  if (!isAuthorizedInternalRequest(event)) {
    return json(401, { message: 'Unauthorized' });
  }

  const cjProductId = event.queryStringParameters?.cjProductId;
  if (!cjProductId) {
    return json(400, { message: 'cjProductId is required' });
  }

  try {
    const data = await getProduct(cjProductId);
    return json(200, data);
  } catch (err) {
    return safeError('cj-product', err, 502, 'Unable to reach the supplier catalog right now.');
  }
}
