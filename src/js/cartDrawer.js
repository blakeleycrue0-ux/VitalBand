import { getCart, subscribe, updateQuantity, removeItem, getSubtotalCents, getItemCount } from './cart.js';
import { formatPrice } from './format.js';
import { startCheckout } from './checkout.js';

function escapeHtml(str = '') {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderLine(item) {
  return `
    <div class="cart-line" data-variant-id="${item.variantId}">
      <div class="cart-line-image">
        <img src="${escapeHtml(item.image || '')}" alt="${escapeHtml(item.name)}" loading="lazy" width="84" height="100" />
      </div>
      <div class="cart-line-content">
        <div class="cart-line-name">${escapeHtml(item.name)}</div>
        <div class="cart-line-variant">${escapeHtml(item.variantName || '')}</div>
        <div class="cart-line-row">
          <div class="qty-control" role="group" aria-label="Quantity">
            <button type="button" data-qty-decrease aria-label="Decrease quantity">&minus;</button>
            <span class="qty-value">${item.quantity}</span>
            <button type="button" data-qty-increase aria-label="Increase quantity">&plus;</button>
          </div>
          <div class="cart-line-price">${formatPrice(item.priceCents * item.quantity)}</div>
        </div>
        <button type="button" class="cart-line-remove" data-remove>Remove</button>
      </div>
    </div>
  `;
}

export function initCartDrawer() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.querySelector('[data-cart-overlay]');
  const body = document.getElementById('cart-drawer-body');
  const foot = document.getElementById('cart-drawer-foot');
  const subtotalEl = document.getElementById('cart-subtotal');
  const checkoutBtn = document.getElementById('cart-checkout-btn');
  const countEls = document.querySelectorAll('.cart-count');

  if (!drawer || !body) return { open: () => {}, close: () => {} };

  let lastFocused = null;

  function open() {
    lastFocused = document.activeElement;
    drawer.classList.add('is-open');
    overlay?.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    drawer.querySelector('button, a')?.focus();
  }

  function close() {
    drawer.classList.remove('is-open');
    overlay?.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocused instanceof HTMLElement) lastFocused.focus();
  }

  document.querySelectorAll('[data-cart-open]').forEach((btn) =>
    btn.addEventListener('click', open)
  );
  document.querySelectorAll('[data-cart-close]').forEach((btn) =>
    btn.addEventListener('click', close)
  );
  overlay?.addEventListener('click', close);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) close();
  });

  body.addEventListener('click', (e) => {
    const line = e.target.closest('.cart-line');
    if (!line) return;
    const variantId = line.dataset.variantId;
    const items = getCart();
    const item = items.find((i) => i.variantId === variantId);
    if (!item) return;

    if (e.target.closest('[data-qty-increase]')) {
      updateQuantity(variantId, item.quantity + 1);
    } else if (e.target.closest('[data-qty-decrease]')) {
      updateQuantity(variantId, item.quantity - 1);
    } else if (e.target.closest('[data-remove]')) {
      removeItem(variantId);
    }
  });

  checkoutBtn?.addEventListener('click', () => startCheckout(getCart(), checkoutBtn));

  subscribe((items) => {
    const count = getItemCount(items);
    countEls.forEach((el) => {
      el.textContent = String(count);
      el.classList.toggle('is-visible', count > 0);
    });

    if (items.length === 0) {
      body.innerHTML = `
        <div class="cart-empty">
          <p>Your cart is empty.</p>
          <button type="button" class="btn btn-secondary" data-cart-close>Continue shopping</button>
        </div>`;
      if (foot) foot.hidden = true;
      return;
    }

    body.innerHTML = items.map(renderLine).join('');
    if (foot) foot.hidden = false;
    if (subtotalEl) subtotalEl.textContent = formatPrice(getSubtotalCents(items));
  });

  return { open, close };
}
