import { getTracking } from './utils/cjClient.js';
import { json, safeError } from './utils/response.js';
import { isAuthorizedInternalRequest } from './utils/internalAuth.js';

// Internal/admin endpoint — proxies CJdropshipping's logistic/trackInfo so
// shipping status can be synced into Supabase orders (tracking_number,
// tracking_url, carrier, fulfillment_status). Customers use track.html /
// order-lookup.js, which reads the already-synced data from Supabase rather
// than calling CJ directly on every page view.
export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return json(405, { message: 'Method not allowed' });
  }
  if (!isAuthorizedInternalRequest(event)) {
    return json(401, { message: 'Unauthorized' });
  }

  const trackingNumber = event.queryStringParameters?.trackingNumber;
  if (!trackingNumber) {
    return json(400, { message: 'trackingNumber is required' });
  }

  try {
    const data = await getTracking(trackingNumber);
    return json(200, data);
  } catch (err) {
    return safeError('cj-tracking', err, 502, 'Tracking information is temporarily unavailable.');
  }
}
