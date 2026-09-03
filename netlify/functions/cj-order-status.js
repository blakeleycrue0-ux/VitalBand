import { getCjOrderStatus } from './utils/cjClient.js';
import { json, safeError } from './utils/response.js';
import { isAuthorizedInternalRequest } from './utils/internalAuth.js';

// Internal/admin endpoint — proxies CJdropshipping's order detail/status
// lookup so fulfillment status can be synced into Supabase orders.
export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return json(405, { message: 'Method not allowed' });
  }
  if (!isAuthorizedInternalRequest(event)) {
    return json(401, { message: 'Unauthorized' });
  }

  const cjOrderId = event.queryStringParameters?.cjOrderId;
  if (!cjOrderId) {
    return json(400, { message: 'cjOrderId is required' });
  }

  try {
    const data = await getCjOrderStatus(cjOrderId);
    return json(200, data);
  } catch (err) {
    return safeError('cj-order-status', err, 502, 'Unable to reach the supplier order system right now.');
  }
}
