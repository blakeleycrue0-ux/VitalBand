import '../css/main.css';
import { supabase } from './supabaseClient.js';
import { formatPrice, starString } from './format.js';
import { initNav } from './nav.js';
import { initCartDrawer } from './cartDrawer.js';
import { addItem } from './cart.js';
import { initSearch } from './search.js';
import { initNotifications } from './notifications.js';
import { startCheckout } from './checkout.js';
import { config } from './config.js';
import { setCanonical } from './seo.js';
import { initPromoBar } from './promoBar.js';

initNav();
const cartDrawer = initCartDrawer();
initSearch();
initNotifications();
initPromoBar();
initAccordion();

function initAccordion() {
  document.querySelectorAll('.product-accordion .faq-item').forEach((item) => {
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

const params = new URLSearchParams(window.location.search);
const slug = params.get('slug') || config.productSlug;

const state = {
  product: null,
  variants: [],
  images: [],
  selectedVariant: null,
  galleryImages: [],
  galleryIndex: 0,
  quantity: 1
};

function escapeHtml(str = '') {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function showError(message) {
  const el = document.getElementById('product-error');
  if (!el) return;
  el.innerHTML = `<div class="inline-message is-error" style="margin-top:16px;">${escapeHtml(message)}</div>`;
}

async function loadProduct() {
  if (!supabase) {
    showError('This storefront is not fully configured yet — Supabase connection details are missing.');
    return;
  }

  try {
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();

    if (productError) throw productError;

    if (!product) {
      document.getElementById('product-info').innerHTML =
        '<h1 class="product-title">Product unavailable</h1><p class="product-desc">This product could not be found or is no longer available. <a href="/" style="text-decoration:underline;">Return home</a>.</p>';
      document.getElementById('gallery').style.display = 'none';
      return;
    }

    const [{ data: variants }, { data: images }, { data: reviews }] = await Promise.all([
      supabase.from('product_variants').select('*').eq('product_id', product.id).eq('is_active', true).order('sort_order'),
      supabase.from('product_images').select('*').eq('product_id', product.id).order('sort_order'),
      supabase.from('reviews').select('*').eq('product_id', product.id).eq('is_approved', true).order('created_at', { ascending: false })
    ]);

    state.product = product;
    state.variants = variants || [];
    state.images = images || [];
    state.selectedVariant = state.variants.find((v) => v.inventory_count > 0) || state.variants[0] || null;

    renderMeta();
    renderInfo();
    renderVariants();
    renderGallery();
    renderReviews(reviews || []);
    bindActions();
  } catch (err) {
    showError('We couldn’t load this product right now. Please refresh or try again shortly.');
  }
}

function renderMeta() {
  const { product } = state;
  document.title = `${product.meta_title || product.name} — ${formatPrice(product.price_cents, product.currency)}`;
  document.getElementById('page-description').setAttribute('content', product.meta_description || product.short_description || '');
  setCanonical(`/product.html?slug=${product.slug}`);
  document.getElementById('og-title').setAttribute('content', product.name);
  document.getElementById('og-description').setAttribute('content', product.short_description || '');
  const primaryImage = state.images.find((i) => i.is_primary) || state.images[0];
  if (primaryImage) document.getElementById('og-image').setAttribute('content', primaryImage.url);

  const jsonLdEl = document.getElementById('product-jsonld');
  if (jsonLdEl) {
    jsonLdEl.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: product.name,
      brand: { '@type': 'Brand', name: 'VitalBand' },
      description: product.short_description || '',
      image: primaryImage ? [primaryImage.url] : [],
      offers: {
        '@type': 'Offer',
        priceCurrency: product.currency,
        price: (product.price_cents / 100).toFixed(2),
        availability: state.variants.some((v) => v.inventory_count > 0) ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        url: `/product.html?slug=${product.slug}`
      }
    });
  }
}

function renderInfo() {
  const { product } = state;
  document.getElementById('product-stars').textContent = starString(product.rating_average || 5);
  document.getElementById('product-rating-count').textContent = `${(product.rating_average || 0).toFixed(1)}/5 · ${product.rating_count?.toLocaleString() || 0}+ reviews`;
  document.getElementById('product-title').textContent = product.name;
  document.getElementById('product-desc').textContent = product.short_description || '';
  updatePriceAndStock();
}

function updatePriceAndStock() {
  const { product, selectedVariant, quantity } = state;
  const priceCents = selectedVariant?.price_cents ?? product.price_cents;
  document.getElementById('product-price').textContent = formatPrice(priceCents, product.currency);
  document.getElementById('current-variant-name').textContent = selectedVariant?.name || '';
  document.getElementById('qty-value').textContent = String(quantity);

  const stockDot = document.querySelector('#stock-note .stock-dot');
  const stockText = document.getElementById('stock-note-text');
  const addBtn = document.getElementById('add-to-cart-btn');
  const buyBtn = document.getElementById('buy-now-btn');
  const mobileAdd = document.getElementById('mobile-add-to-cart');
  const mobileBuy = document.getElementById('mobile-buy-now');

  const inv = selectedVariant?.inventory_count ?? 0;
  let label = 'In stock';
  stockDot.className = 'stock-dot';
  if (!selectedVariant) {
    label = 'Unavailable';
    stockDot.classList.add('is-out');
  } else if (inv <= 0) {
    label = 'Out of stock';
    stockDot.classList.add('is-out');
  } else if (inv <= 10) {
    label = `Low stock — only ${inv} left`;
    stockDot.classList.add('is-low');
  }
  stockText.textContent = label;

  const disabled = !selectedVariant || inv <= 0;
  [addBtn, buyBtn, mobileAdd, mobileBuy].forEach((btn) => { if (btn) btn.disabled = disabled; });
}

function renderVariants() {
  const row = document.getElementById('variant-row');
  row.innerHTML = state.variants
    .map((v) => {
      const soldOut = v.inventory_count <= 0;
      return `
        <button type="button" class="variant-pill" data-variant-id="${v.id}"
          aria-pressed="${v.id === state.selectedVariant?.id}" ${soldOut ? 'disabled' : ''}>
          <span class="dot" style="background:${v.hex_color || '#ccc'}"></span>
          ${escapeHtml(v.name)}${soldOut ? ' (Sold out)' : ''}
        </button>`;
    })
    .join('');

  row.addEventListener('click', (e) => {
    const btn = e.target.closest('.variant-pill');
    if (!btn || btn.disabled) return;
    state.selectedVariant = state.variants.find((v) => v.id === btn.dataset.variantId);
    state.quantity = 1;
    row.querySelectorAll('.variant-pill').forEach((p) => p.setAttribute('aria-pressed', p === btn ? 'true' : 'false'));
    updatePriceAndStock();
    renderGallery();
  });
}

function renderGallery() {
  const variantId = state.selectedVariant?.id;
  const images = state.images.filter((i) => !i.variant_id || i.variant_id === variantId);
  state.galleryImages = images.length ? images : state.images;
  state.galleryIndex = 0;
  paintGallery();
}

function paintGallery() {
  const track = document.getElementById('gallery-track');
  const thumbs = document.getElementById('gallery-thumbs');
  const counter = document.getElementById('gallery-counter');
  const images = state.galleryImages;

  track.innerHTML = images
    .map(
      (img, i) => `<div class="gallery-slide" data-index="${i}"><img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.alt_text || state.product.name)}" loading="${i === 0 ? 'eager' : 'lazy'}" width="1200" height="1500" /></div>`
    )
    .join('');

  thumbs.innerHTML = images
    .map(
      (img, i) => `<button type="button" class="gallery-thumb" data-index="${i}" aria-current="${i === 0}"><img src="${escapeHtml(img.url)}" alt="" loading="lazy" width="120" height="150" /></button>`
    )
    .join('');

  updateGalleryPosition();

  counter.textContent = `1 / ${images.length}`;
}

function updateGalleryPosition() {
  const track = document.getElementById('gallery-track');
  const counter = document.getElementById('gallery-counter');
  const thumbs = document.querySelectorAll('.gallery-thumb');
  track.style.transform = `translateX(-${state.galleryIndex * 100}%)`;
  counter.textContent = `${state.galleryIndex + 1} / ${state.galleryImages.length}`;
  thumbs.forEach((t, i) => t.setAttribute('aria-current', String(i === state.galleryIndex)));
}

function bindGalleryNav() {
  document.getElementById('gallery-prev').addEventListener('click', () => {
    state.galleryIndex = (state.galleryIndex - 1 + state.galleryImages.length) % state.galleryImages.length;
    updateGalleryPosition();
  });
  document.getElementById('gallery-next').addEventListener('click', () => {
    state.galleryIndex = (state.galleryIndex + 1) % state.galleryImages.length;
    updateGalleryPosition();
  });
  document.getElementById('gallery-thumbs').addEventListener('click', (e) => {
    const btn = e.target.closest('.gallery-thumb');
    if (!btn) return;
    state.galleryIndex = Number(btn.dataset.index);
    updateGalleryPosition();
  });

  // Swipe support
  const main = document.getElementById('gallery-main');
  let startX = 0;
  main.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
  main.addEventListener('touchend', (e) => {
    const delta = e.changedTouches[0].clientX - startX;
    if (Math.abs(delta) > 40) {
      if (delta < 0) document.getElementById('gallery-next').click();
      else document.getElementById('gallery-prev').click();
    }
  });

  // Zoom
  const zoomOverlay = document.getElementById('zoom-overlay');
  const zoomImage = document.getElementById('zoom-image');
  document.getElementById('gallery-track').addEventListener('click', (e) => {
    const slide = e.target.closest('.gallery-slide');
    if (!slide) return;
    zoomImage.src = slide.querySelector('img').src;
    zoomImage.alt = slide.querySelector('img').alt;
    zoomOverlay.classList.add('is-open');
  });
  document.getElementById('zoom-close').addEventListener('click', () => zoomOverlay.classList.remove('is-open'));
  zoomOverlay.addEventListener('click', (e) => { if (e.target === zoomOverlay) zoomOverlay.classList.remove('is-open'); });
}

function renderReviews(reviews) {
  const list = document.getElementById('review-list');
  if (!reviews.length) {
    list.innerHTML = '<p style="color:var(--fg-muted);">No reviews yet.</p>';
    return;
  }
  list.innerHTML = reviews
    .map(
      (r) => `
      <div class="review-item">
        <div class="review-head">
          <span class="review-avatar">${escapeHtml((r.author_name || '?').charAt(0).toUpperCase())}</span>
          <div>
            <span class="review-author">${escapeHtml(r.author_name)}</span>
            <div class="stars" style="font-size:12px;">${starString(r.rating)}</div>
          </div>
          ${r.is_demo ? '<span class="demo-badge" style="margin-left:auto;">Demo</span>' : ''}
        </div>
        ${r.title ? `<div class="review-title">${escapeHtml(r.title)}</div>` : ''}
        <p class="review-body">${escapeHtml(r.body)}</p>
      </div>`
    )
    .join('');
}

function currentCartItem() {
  const { product, selectedVariant, quantity, galleryImages } = state;
  return {
    productId: product.id,
    variantId: selectedVariant.id,
    slug: product.slug,
    name: product.name,
    variantName: selectedVariant.name,
    priceCents: selectedVariant.price_cents ?? product.price_cents,
    image: galleryImages[0]?.url || state.images[0]?.url,
    cjProductId: product.cj_product_id,
    cjVariantId: selectedVariant.cj_variant_id,
    maxQuantity: selectedVariant.inventory_count
  };
}

function bindActions() {
  bindGalleryNav();

  document.getElementById('qty-decrease').addEventListener('click', () => {
    state.quantity = Math.max(1, state.quantity - 1);
    updatePriceAndStock();
  });
  document.getElementById('qty-increase').addEventListener('click', () => {
    const max = Math.min(10, state.selectedVariant?.inventory_count ?? 10);
    state.quantity = Math.min(max, state.quantity + 1);
    updatePriceAndStock();
  });

  function doAddToCart() {
    if (!state.selectedVariant) return;
    addItem(currentCartItem(), state.quantity);
    cartDrawer.open();
  }

  function doBuyNow() {
    if (!state.selectedVariant) return;
    const item = currentCartItem();
    startCheckout([{ variantId: item.variantId, quantity: state.quantity }], this);
  }

  document.getElementById('add-to-cart-btn').addEventListener('click', doAddToCart);
  document.getElementById('mobile-add-to-cart').addEventListener('click', doAddToCart);
  document.getElementById('buy-now-btn').addEventListener('click', function () { doBuyNow.call(this); });
  document.getElementById('mobile-buy-now').addEventListener('click', function () { doBuyNow.call(this); });
}

loadProduct();
