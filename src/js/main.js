import '../css/main.css';
import { supabase } from './supabaseClient.js';
import { formatPrice } from './format.js';
import { initNav } from './nav.js';
import { initCartDrawer } from './cartDrawer.js';
import { addItem } from './cart.js';
import { initSearch } from './search.js';
import { initNotifications } from './notifications.js';
import { initReveal } from './reveal.js';
import { setCanonical } from './seo.js';

setCanonical('/');
initNav();
initCartDrawer();
initSearch();
initNotifications();
initReveal();
initFaq();
loadHeroImage();
loadShowcase();
loadTestimonials();

function initFaq() {
  document.querySelectorAll('.faq-item').forEach((item) => {
    const question = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');
    question.addEventListener('click', () => {
      const isOpen = item.getAttribute('data-open') === 'true';
      item.setAttribute('data-open', String(!isOpen));
      question.setAttribute('aria-expanded', String(!isOpen));
      answer.style.maxHeight = !isOpen ? `${answer.scrollHeight}px` : '0px';
    });
  });
}

async function loadHeroImage() {
  if (!supabase) return;
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'hero').maybeSingle();
  const url = data?.value?.image_url;
  if (url) {
    const img = document.getElementById('hero-image');
    if (img) img.src = url;
  }
}

async function loadShowcase() {
  if (!supabase) return;

  const { data: product } = await supabase
    .from('products')
    .select('id, name, price_cents, currency, hero_image_url')
    .eq('slug', 'smart-bracelet')
    .eq('is_active', true)
    .maybeSingle();

  if (!product) return;

  const priceEl = document.getElementById('showcase-price');
  if (priceEl) priceEl.textContent = formatPrice(product.price_cents, product.currency);

  const { data: variants } = await supabase
    .from('product_variants')
    .select('id, name, hex_color, inventory_count, is_active, price_cents')
    .eq('product_id', product.id)
    .eq('is_active', true)
    .order('sort_order');

  const { data: images } = await supabase
    .from('product_images')
    .select('url, alt_text, is_primary')
    .eq('product_id', product.id)
    .order('sort_order')
    .limit(1);

  const showcaseImg = document.getElementById('showcase-image');
  if (showcaseImg && images && images[0]) {
    showcaseImg.src = images[0].url;
    showcaseImg.alt = images[0].alt_text || product.name;
  }

  const variantsEl = document.getElementById('showcase-variants');
  let selected = variants?.[0];
  if (variantsEl && variants?.length) {
    variantsEl.innerHTML = variants
      .map(
        (v) => `<button type="button" class="swatch" style="background:${v.hex_color || '#ccc'}" title="${v.name}" aria-label="${v.name}" data-variant-id="${v.id}" aria-pressed="${v === selected}"></button>`
      )
      .join('');

    variantsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.swatch');
      if (!btn) return;
      selected = variants.find((v) => v.id === btn.dataset.variantId);
      variantsEl.querySelectorAll('.swatch').forEach((s) => s.setAttribute('aria-pressed', s === btn ? 'true' : 'false'));
    });
  }

  document.querySelector('[data-quick-add]')?.addEventListener('click', () => {
    if (!selected) return;
    addItem({
      productId: product.id,
      variantId: selected.id,
      slug: 'smart-bracelet',
      name: product.name,
      variantName: selected.name,
      priceCents: selected.price_cents ?? product.price_cents,
      image: images?.[0]?.url,
      maxQuantity: selected.inventory_count
    });
    document.querySelector('[data-cart-open]')?.click();
  });
}

async function loadTestimonials() {
  const track = document.getElementById('testimonial-track');
  if (!track) return;

  if (!supabase) {
    track.innerHTML = `<p class="search-hint">Reviews will appear here once connected to Supabase.</p>`;
    return;
  }

  const { data, error } = await supabase
    .from('testimonials')
    .select('quote, author_name, author_title, is_demo')
    .eq('is_approved', true)
    .order('sort_order')
    .limit(9);

  if (error || !data?.length) {
    track.innerHTML = `<p class="search-hint">No testimonials to show yet.</p>`;
    return;
  }

  track.innerHTML = data
    .map(
      (t) => `
      <div class="testimonial-card">
        <p class="testimonial-quote">&ldquo;${escapeHtml(t.quote)}&rdquo;</p>
        <div class="testimonial-attrib">
          <div>
            <div class="testimonial-author">${escapeHtml(t.author_name)}</div>
            ${t.author_title ? `<div class="testimonial-role">${escapeHtml(t.author_title)}</div>` : ''}
          </div>
          ${t.is_demo ? '<span class="demo-badge">Demo</span>' : ''}
        </div>
      </div>`
    )
    .join('');
}

function escapeHtml(str = '') {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
