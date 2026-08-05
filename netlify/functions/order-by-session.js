import { getSupabaseAdmin } from './utils/supabaseAdmin.js';
import { json, safeError } from './utils/response.js';

// Used only by success.html right after a Stripe redirect. The Stripe
// Checkout session id is a long, single-use, unguessable token that only
// the shopper who just completed (or cancelled) that specific checkout
// possesses — so looking an order up by it here (read-only, minimal fields)
// does not expose other customers' data the way a raw order-number lookup
// without an email check would.
export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return json(405, { message: 'Method not allowed' });
  }

  const sessionId = event.queryStringParameters?.session_id;
  if (!sessionId) {
    return json(400, { message: 'session_id is required' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: order, error } = await supabase
      .from('orders')
      .select('order_number, status, payment_status')
      .eq('checkout_session_id', sessionId)
      .maybeSingle();

    if (error) throw error;
    if (!order) {
      return json(404, { message: 'Order not found yet.' });
    }

    return json(200, {
      orderNumber: order.order_number,
      status: order.status
    });
  } catch (err) {
    return safeError('order-by-session', err, 500);
  }
}
