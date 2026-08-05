import '../css/main.css';
import { setCanonical } from './seo.js';

setCanonical('/track.html');

const STEPS = [
  { key: 'pending', label: 'Order placed', desc: 'We’ve received your order.' },
  { key: 'paid', label: 'Payment confirmed', desc: 'Your payment was successful.' },
  { key: 'processing', label: 'Preparing shipment', desc: 'Your order is being prepared for fulfillment.' },
  { key: 'shipped', label: 'Shipped', desc: 'Your order is on its way.' },
  { key: 'delivered', label: 'Delivered', desc: 'Your order has arrived.' }
];

function escapeHtml(str = '') {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const form = document.getElementById('track-form');
const submitBtn = document.getElementById('track-submit');
const errorEl = document.getElementById('track-error');
const resultEl = document.getElementById('order-result');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.innerHTML = '';
  resultEl.hidden = true;

  const orderNumber = document.getElementById('order-number-input').value.trim();
  const email = document.getElementById('email-input').value.trim();

  if (!orderNumber || !email) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Looking up…';

  try {
    const res = await fetch('/.netlify/functions/order-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNumber, email })
    });

    const data = await res.json().catch(() => ({}));

    if (res.status === 404) {
      showError('We couldn’t find an order matching that order number and email. Double-check both and try again.');
      return;
    }
    if (!res.ok) {
      showError(data.message || 'Something went wrong looking up your order. Please try again shortly.');
      return;
    }

    renderResult(data);
  } catch {
    showError('We’re having trouble connecting right now. Please check your connection and try again.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Track order';
  }
});

function showError(message) {
  errorEl.innerHTML = `<div class="inline-message is-error" style="margin-top:20px;">${escapeHtml(message)}</div>`;
}

function renderResult(order) {
  resultEl.hidden = false;
  document.getElementById('result-order-number').textContent = order.orderNumber;
  document.getElementById('result-status-pill').textContent = order.status;

  // "processing" (displayed) maps to the "fulfilled" backend status.
  const normalizedStatus = order.status === 'fulfilled' ? 'processing' : order.status;
  const currentIndex = STEPS.findIndex((s) => s.key === normalizedStatus);
  const track = document.getElementById('status-track');
  track.innerHTML = STEPS.map((step, i) => {
    const done = currentIndex >= 0 && i <= currentIndex;
    const isCurrent = i === currentIndex;
    return `
      <div class="status-step ${done ? 'is-done' : ''} ${isCurrent ? 'is-current' : ''}">
        <span class="dot"></span>
        <div>
          <div class="status-step-label">${step.label}</div>
          <div class="status-step-desc">${step.desc}</div>
        </div>
      </div>`;
  }).join('');

  const trackingWrap = document.getElementById('tracking-detail');
  if (order.trackingNumber) {
    trackingWrap.hidden = false;
    document.getElementById('result-carrier').textContent = order.carrier || '—';
    document.getElementById('result-tracking-number').textContent = order.trackingNumber;
    const link = document.getElementById('result-tracking-link');
    if (order.trackingUrl) {
      link.href = order.trackingUrl;
      document.getElementById('result-tracking-link-wrap').hidden = false;
    } else {
      document.getElementById('result-tracking-link-wrap').hidden = true;
    }
  } else {
    trackingWrap.hidden = true;
  }
}
