import { json, safeError } from './utils/response.js';
import { isAuthorizedInternalRequest } from './utils/internalAuth.js';
import { submitOrderToCj } from './utils/fulfillment.js';

// Internal/admin endpoint for manually (re)submitting a paid Supabase order
// to CJdropshipping — e.g. retrying a failed automatic submission. The
// automatic path is stripe-webhook.js, which only submits orders that have
// already been verified as paid; this endpoint enforces the same check.
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

  if (!body.orderId) {
    return json(400, { message: 'orderId is required' });
  }

  try {
    const result = await submitOrderToCj(body.orderId);
    return json(200, result);
  } catch (err) {
    return safeError('cj-create-order', err, 502, 'Unable to submit this order to the supplier right now.');
  }
}
