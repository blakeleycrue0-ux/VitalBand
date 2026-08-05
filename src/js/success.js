import '../css/main.css';
import { clearCart } from './cart.js';

const params = new URLSearchParams(window.location.search);
const sessionId = params.get('session_id');

clearCart();

const card = document.getElementById('order-card');
const orderNumberEl = document.getElementById('order-number');
const statusPill = document.getElementById('order-status-pill');
const errorEl = document.getElementById('success-error');
const heading = document.getElementById('status-heading');
const lead = document.getElementById('status-lead');

if (!sessionId) {
  heading.textContent = 'Order confirmation';
  lead.textContent = 'We couldn’t find a checkout session to confirm. If you just completed a purchase, check your email for confirmation, or track your order below.';
} else {
  pollOrderStatus();
}

async function pollOrderStatus(attempt = 0) {
  try {
    const res = await fetch(`/.netlify/functions/order-by-session?session_id=${encodeURIComponent(sessionId)}`);
    const data = await res.json().catch(() => ({}));

    if (res.status === 404 && attempt < 5) {
      // Webhook may not have processed yet — the browser reaching this page
      // does not itself create the order (see netlify/functions/stripe-webhook.js).
      setTimeout(() => pollOrderStatus(attempt + 1), 2000);
      return;
    }

    if (!res.ok) throw new Error(data.message || 'lookup failed');

    card.hidden = false;
    orderNumberEl.textContent = data.orderNumber;
    statusPill.textContent = formatStatus(data.status);
    lead.textContent = 'Your order has been received. We’ll email tracking details as soon as it ships.';
  } catch (err) {
    errorEl.innerHTML =
      '<div class="inline-message is-error" style="margin-top:24px;">We could not confirm your order automatically. If your payment succeeded, you will still receive an email confirmation — you can also check status any time on the tracking page.</div>';
  }
}

function formatStatus(status) {
  const map = {
    pending: 'Processing',
    paid: 'Payment confirmed',
    processing: 'Preparing shipment',
    fulfilled: 'Fulfilled',
    shipped: 'Shipped',
    delivered: 'Delivered'
  };
  return map[status] || status;
}
