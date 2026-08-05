import { supabase } from './supabaseClient.js';
import { formatPrice } from './format.js';

// Static, non-product site content that's reasonable to surface in search.
const SITE_CONTENT = [
  { title: 'Features', description: 'Heart rate, sleep tracking, battery life and more.', href: '/#features' },
  { title: 'How it works', description: 'Order, unbox, pair with the app.', href: '/#how-it-works' },
  { title: 'Reviews', description: 'What customers say about VitalBand.', href: '/#testimonials' },
  { title: 'FAQ', description: 'Shipping, returns, battery and compatibility questions.', href: '/#faq' },
  { title: 'Track your order', description: 'Check order status, payment and shipping.', href: '/track.html' }
];

function escapeHtml(str = '') {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function initSearch() {
  const overlay = document.getElementById('search-overlay');
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  if (!overlay || !input || !results) return;

  const open = () => {
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => input.focus(), 50);
  };
  const close = () => {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    input.value = '';
    renderIdle();
  };

  document.querySelectorAll('[data-search-open]').forEach((btn) => btn.addEventListener('click', open));
  document.querySelectorAll('[data-search-close]').forEach((btn) => btn.addEventListener('click', close));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) close();
    if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) && !overlay.classList.contains('is-open')) {
      const active = document.activeElement;
      const typing = active && ['INPUT', 'TEXTAREA'].includes(active.tagName);
      if (!typing) {
        e.preventDefault();
        open();
      }
    }
  });

  function renderIdle() {
    results.innerHTML = `<p class="search-hint">Try "bracelet", "features" or "shipping".</p>`;
  }

  function renderProductResults(products) {
    return products
      .map(
        (p) => `
      <a class="search-result-item" href="/product.html?slug=${encodeURIComponent(p.slug)}">
        <div class="search-result-thumb"><img src="${escapeHtml(p.hero_image_url || '')}" alt="" loading="lazy" width="56" height="64" /></div>
        <div>
          <div class="search-result-name">${escapeHtml(p.name)}</div>
          <div class="search-result-price">${formatPrice(p.price_cents, p.currency)}</div>
        </div>
      </a>`
      )
      .join('');
  }

  function renderContentResults(items) {
    return items
      .map(
        (c) => `
      <a class="search-result-item" href="${c.href}">
        <div>
          <div class="search-result-name">${escapeHtml(c.title)}</div>
          <div class="search-result-price">${escapeHtml(c.description)}</div>
        </div>
      </a>`
      )
      .join('');
  }

  const runSearch = debounce(async (term) => {
    const q = term.trim().toLowerCase();
    if (!q) return renderIdle();

    const matchedContent = SITE_CONTENT.filter(
      (c) => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    );

    let productHtml = '';
    if (supabase) {
      const { data, error } = await supabase
        .from('products')
        .select('slug, name, price_cents, currency, hero_image_url')
        .eq('is_active', true)
        .or(`name.ilike.%${q}%,short_description.ilike.%${q}%`)
        .limit(6);
      if (!error && data) productHtml = renderProductResults(data);
    }

    const contentHtml = renderContentResults(matchedContent);
    const combined = productHtml + contentHtml;
    results.innerHTML = combined || `<p class="search-hint">No results for "${escapeHtml(term)}".</p>`;
  }, 220);

  input.addEventListener('input', (e) => runSearch(e.target.value));
  renderIdle();
}
