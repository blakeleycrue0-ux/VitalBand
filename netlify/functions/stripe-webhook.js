import { getStripe } from './utils/stripeClient.js';
import { getSupabaseAdmin } from './utils/supabaseAdmin.js';
import { submitOrderToCj } from './utils/fulfillment.js';
import { json } from './utils/response.js';

// This is the ONLY place a paid order is confirmed and pushed to
// fulfillment. Reaching success.html in a browser does nothing on its own —
// it just polls Supabase (via order-by-session.js) for whatever this
// webhook has already written. That is what prevents someone from getting
// a "free" order just by navigating to the success URL without paying.
export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { message: 'Method not allowed' });
  }

  const signature = event.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return json(400, { message: 'Missing signature.' });
  }

  const stripe = getStripe();
  const rawBody = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('[stripe-webhook] signature verification failed', err.message);
    return json(400, { message: 'Invalid signature.' });
  }

  try {
    if (stripeEvent.type === 'checkout.session.completed' || stripeEvent.type === 'checkout.session.async_payment_succeeded') {
      await handleCheckoutCompleted(stripeEvent.data.object);
    } else if (stripeEvent.type === 'checkout.session.async_payment_failed') {
      await handlePaymentFailed(stripeEvent.data.object);
    }
  } catch (err) {
    // Returning 500 tells Stripe to retry the webhook — appropriate for
    // transient failures (DB hiccup, CJ API blip). Stripe retries with backoff.
    console.error('[stripe-webhook] handler error', err);
    return json(500, { message: 'Webhook handler error' });
  }

  return json(200, { received: true });
}

async function handleCheckoutCompleted(session) {
  const supabase = getSupabaseAdmin();
  const orderId = session.metadata?.order_id;
  if (!orderId) {
    console.error('[stripe-webhook] checkout.session.completed with no order_id metadata', session.id);
    return;
  }

  const stripe = getStripe();
  const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
    expand: ['customer_details']
  });

  const email = fullSession.customer_details?.email || fullSession.customer_email;
  const shipping = fullSession.shipping_details || fullSession.customer_details;
  const shippingAddress = shipping
    ? {
        name: shipping.name,
        line1: shipping.address?.line1,
        line2: shipping.address?.line2,
        city: shipping.address?.city,
        state: shipping.address?.state,
        postalCode: shipping.address?.postal_code,
        countryCode: shipping.address?.country,
        phone: fullSession.customer_details?.phone
      }
    : null;

  let customerId = null;
  if (email) {
    const { data: existingCustomer } = await supabase.from('customers').select('id').eq('email', email).maybeSingle();
    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      const { data: newCustomer } = await supabase
        .from('customers')
        .insert({ email, first_name: shipping?.name?.split(' ')?.[0] || null })
        .select('id')
        .single();
      customerId = newCustomer?.id || null;
    }
  }

  const { data: order, error: updateError } = await supabase
    .from('orders')
    .update({
      email: email || 'unknown@checkout',
      customer_id: customerId,
      status: 'paid',
      payment_status: 'paid',
      payment_intent_id: typeof fullSession.payment_intent === 'string' ? fullSession.payment_intent : fullSession.payment_intent?.id,
      shipping_address: shippingAddress,
      total_cents: fullSession.amount_total ?? undefined,
      shipping_cents: fullSession.shipping_cost?.amount_total ?? 0
    })
    .eq('id', orderId)
    .select()
    .single();

  if (updateError || !order) {
    throw new Error(`Failed to update order ${orderId} after payment: ${updateError?.message}`);
  }

  // Decrement inventory now that the sale is confirmed.
  const { data: items } = await supabase.from('order_items').select('variant_id, quantity').eq('order_id', orderId);
  for (const item of items || []) {
    if (!item.variant_id) continue;
    await supabase.rpc('decrement_variant_inventory', { p_variant_id: item.variant_id, p_quantity: item.quantity }).catch(() => {
      // Falls back silently if the RPC isn't installed — inventory sync can
      // also be reconciled manually from the CJ inventory feed.
    });
  }

  // Only submit to CJ if every line item has a real cj_variant_id configured.
  try {
    await submitOrderToCj(orderId);
  } catch (err) {
    console.error(`[stripe-webhook] CJ submission failed for order ${orderId}`, err.message);
    // Payment already succeeded — do not fail the webhook. Fulfillment can
    // be retried via the cj-create-order admin endpoint once CJ IDs/config
    // are fixed. The order stays visible to the customer as "paid".
  }

  // Real, non-demo activity event for the LIVE notifications mode. No PII.
  await supabase.from('notification_events').insert({
    event_type: 'purchase',
    message: 'Someone just purchased the Smart Bracelet.',
    is_demo: false
  });
}

async function handlePaymentFailed(session) {
  const supabase = getSupabaseAdmin();
  const orderId = session.metadata?.order_id;
  if (!orderId) return;

  await supabase
    .from('orders')
    .update({ status: 'failed', payment_status: 'failed' })
    .eq('id', orderId);
}
