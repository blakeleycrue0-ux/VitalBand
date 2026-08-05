// Cart state: persisted to localStorage for anonymous shoppers. If
// authentication is introduced later, this module is the single place to
// add a sync-to-Supabase step (e.g. on login, merge local cart into a
// `cart_items` table keyed by the authenticated user id).
const STORAGE_KEY = 'vitalband:cart:v1';

const listeners = new Set();

function readCart() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCart(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  listeners.forEach((fn) => fn(items));
}

export function getCart() {
  return readCart();
}

export function subscribe(fn) {
  listeners.add(fn);
  fn(readCart());
  return () => listeners.delete(fn);
}

export function addItem({ productId, variantId, slug, name, variantName, priceCents, image, cjProductId, cjVariantId, maxQuantity }, quantity = 1) {
  const items = readCart();
  const existing = items.find((i) => i.variantId === variantId);
  const cap = typeof maxQuantity === 'number' ? maxQuantity : Infinity;

  if (existing) {
    existing.quantity = Math.min(existing.quantity + quantity, cap);
  } else {
    items.push({
      productId,
      variantId,
      slug,
      name,
      variantName,
      priceCents,
      image,
      cjProductId: cjProductId ?? null,
      cjVariantId: cjVariantId ?? null,
      quantity: Math.min(quantity, cap)
    });
  }
  writeCart(items);
}

export function updateQuantity(variantId, quantity) {
  let items = readCart();
  if (quantity <= 0) {
    items = items.filter((i) => i.variantId !== variantId);
  } else {
    items = items.map((i) => (i.variantId === variantId ? { ...i, quantity } : i));
  }
  writeCart(items);
}

export function removeItem(variantId) {
  writeCart(readCart().filter((i) => i.variantId !== variantId));
}

export function clearCart() {
  writeCart([]);
}

export function getItemCount(items = readCart()) {
  return items.reduce((sum, i) => sum + i.quantity, 0);
}

export function getSubtotalCents(items = readCart()) {
  return items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
}
