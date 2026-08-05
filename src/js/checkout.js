// Kicks off Stripe Checkout via a Netlify Function. No payment logic, card
// fields or secrets ever touch the browser — the function creates a hosted
// Stripe Checkout Session server-side and we just redirect to its URL.
export async function startCheckout(items, triggerEl) {
  if (!items || items.length === 0) return;

  const originalText = triggerEl?.textContent;
  if (triggerEl) {
    triggerEl.disabled = true;
    triggerEl.textContent = 'Preparing checkout…';
  }

  try {
    const res = await fetch('/.netlify/functions/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: items.map((i) => ({
          variantId: i.variantId,
          quantity: i.quantity
        })),
        successUrl: `${window.location.origin}/success.html`,
        cancelUrl: `${window.location.origin}/cancel.html`
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.url) {
      throw new Error(data.message || 'Checkout is temporarily unavailable.');
    }

    window.location.href = data.url;
  } catch (err) {
    if (triggerEl) {
      triggerEl.disabled = false;
      triggerEl.textContent = originalText;
    }
    showCheckoutError(err.message);
  }
}

function showCheckoutError(message) {
  const existing = document.querySelector('.checkout-error-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.className = 'inline-message is-error checkout-error-banner';
  banner.style.position = 'fixed';
  banner.style.left = '50%';
  banner.style.bottom = '24px';
  banner.style.transform = 'translateX(-50%)';
  banner.style.zIndex = '300';
  banner.style.background = 'var(--bg-elevated)';
  banner.style.maxWidth = '360px';
  banner.textContent = message || 'Something went wrong starting checkout. Please try again.';
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 6000);
}
