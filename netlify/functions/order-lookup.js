import { getSupabaseAdmin } from './utils/supabaseAdmin.js';
import { json, safeError } from './utils/response.js';

// Secure order tracking lookup. Requires BOTH the order number and the
// email used at checkout to match — this is what stops one customer from
// looking up another customer's order/shipping info. Runs entirely through
// the service role key (server-side); orders/customers have no public
// Supabase RLS policy at all (see supabase/migrations/0001_init.sql).
export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { message: 'Method not allowed' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { message: 'Invalid request body.' });
  }

  const orderNumber = (body.orderNumber || '').trim();
  const email = (body.email || '').trim().toLowerCase();

  if (!orderNumber || !email) {
    return json(400, { message: 'Order number and email are required.' });
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: order, error } = await supabase
      .from('orders')
      .select('order_number, status, fulfillment_status, tracking_number, tracking_url, carrier, email')
      .ilike('order_number', orderNumber)
      .maybeSingle();

    if (error) throw error;

    // Same generic 404 whether the order doesn't exist or the email simply
    // doesn't match — never confirm/deny order existence to a wrong email.
    if (!order || order.email.toLowerCase() !== email) {
      return json(404, { message: 'Order not found.' });
    }

    return json(200, {
      orderNumber: order.order_number,
      status: order.status,
      fulfillmentStatus: order.fulfillment_status,
      trackingNumber: order.tracking_number,
      trackingUrl: order.tracking_url,
      carrier: order.carrier
    });
  } catch (err) {
    return safeError('order-lookup', err, 500, 'We couldn’t look up your order right now. Please try again shortly.');
  }
}
