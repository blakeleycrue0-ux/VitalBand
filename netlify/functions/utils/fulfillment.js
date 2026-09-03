import { getSupabaseAdmin } from './supabaseAdmin.js';
import { createCjOrder } from './cjClient.js';

// Submits an already-paid Supabase order to CJdropshipping for fulfillment
// and records the resulting CJ order id. Shared by stripe-webhook.js (the
// automatic path, invoked only after payment is verified) and the
// cj-create-order.js admin endpoint (manual retry path).
export async function submitOrderToCj(orderId) {
  const supabase = getSupabaseAdmin();

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', orderId)
    .single();

  if (orderError || !order) {
    throw new Error(`Order ${orderId} not found`);
  }

  if (order.payment_status !== 'paid') {
    throw new Error(`Order ${orderId} has not been paid — refusing to submit to CJ`);
  }

  if (order.cj_order_id) {
    return { alreadySubmitted: true, cjOrderId: order.cj_order_id };
  }

  const itemsMissingCjIds = order.order_items.filter((i) => !i.cj_variant_id);
  if (itemsMissingCjIds.length > 0) {
    await supabase
      .from('orders')
      .update({ fulfillment_status: 'failed' })
      .eq('id', orderId);
    throw new Error(
      `Order ${orderId} has line items without a configured CJ variant ID — cannot submit to CJ until product_variants.cj_variant_id is set.`
    );
  }

  const shippingAddress = order.shipping_address || {};

  const cjResponse = await createCjOrder({
    orderNumber: order.order_number,
    shippingAddress,
    items: order.order_items.map((i) => ({
      cjVariantId: i.cj_variant_id,
      quantity: i.quantity
    }))
  });

  const cjOrderId = cjResponse?.data?.orderId || cjResponse?.data?.cjOrderId;

  await supabase
    .from('orders')
    .update({
      cj_order_id: cjOrderId || null,
      fulfillment_status: cjOrderId ? 'submitted_to_cj' : 'failed',
      status: cjOrderId ? 'processing' : order.status
    })
    .eq('id', orderId);

  return { alreadySubmitted: false, cjOrderId };
}
