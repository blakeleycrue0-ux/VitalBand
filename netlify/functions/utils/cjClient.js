// ============================================================================
// CJdropshipping API v2 client (server-side only — netlify/functions/**).
//
// IMPORTANT — verify before going live:
// CJ's documentation site (developers.cjdropshipping.com /
// developers.cjdropshipping.cn) blocks automated/bot fetches, so the exact
// request/response field names below could not be directly re-verified from
// this environment at build time. What IS confirmed via CJ's own published
// docs/search index as of this build:
//   - Base URL:            https://developers.cjdropshipping.com/api2.0/v1
//   - Auth endpoint:       POST /authentication/getAccessToken
//   - Auth header on all
//     other requests:      CJ-Access-Token: <accessToken>
//   - Product endpoints:   GET /product/list, GET /product/query,
//                          GET /product/variant/query, GET /product/comments
//   - Logistics endpoint:  GET /logistic/trackInfo?trackNumber=...
//   - Rate limit:          1 request/second (QPS = 1) per CJ's docs
//   - getAccessToken responses are cached server-side by CJ for 24h per
//     account, so calling it fresh on every cold start is safe and does not
//     generate a new token each time.
//
// Before enabling real orders, log into your CJ account, open
// developers.cjdropshipping.com/en/api/api2/ yourself (a browser, not a bot,
// can load it), and confirm:
//   1. The exact getAccessToken request body (this client sends
//      { email, password } where `password` is the API key from
//      CJ Personal Center → API → Get API Key — confirm this matches).
//   2. The exact createOrder request/response shape under the "Shopping"
//      module (this client uses a reasonable best-guess shape below and
//      isolates it in createOrder() so it's a single, obvious place to fix).
//   3. The exact getOrderDetail request/response shape.
// ============================================================================

const BASE_URL = 'https://developers.cjdropshipping.com/api2.0/v1';

let cachedToken = null;
let cachedTokenExpiry = 0;

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiry) {
    return cachedToken;
  }

  const email = process.env.CJ_EMAIL;
  const apiKey = process.env.CJ_API_KEY;

  if (!email || !apiKey) {
    throw new Error('CJ_EMAIL / CJ_API_KEY are not configured.');
  }

  const res = await fetch(`${BASE_URL}/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: apiKey })
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.data?.accessToken) {
    throw new Error(`CJ authentication failed: ${data?.message || res.status}`);
  }

  cachedToken = data.data.accessToken;
  // Cache in-memory for this warm function instance; well under CJ's 24h
  // server-side token cache window.
  cachedTokenExpiry = Date.now() + 12 * 60 * 60 * 1000;
  return cachedToken;
}

async function cjRequest(path, { method = 'GET', query, body } = {}) {
  const token = await getAccessToken();
  const url = new URL(`${BASE_URL}${path}`);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    });
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      'Content-Type': 'application/json',
      'CJ-Access-Token': token
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data?.result === false) {
    throw new Error(`CJ API error on ${path}: ${data?.message || res.status}`);
  }

  return data;
}

export async function getProduct(cjProductId) {
  return cjRequest('/product/query', { query: { pid: cjProductId } });
}

export async function getVariantInventory(cjProductId) {
  return cjRequest('/product/variant/query', { query: { pid: cjProductId } });
}

// Best-guess request shape for the Shopping module's order creation
// endpoint — confirm field names against current CJ docs before relying on
// this in production (see notice above).
export async function createCjOrder({ orderNumber, shippingAddress, items }) {
  return cjRequest('/shopping/order/createOrder', {
    method: 'POST',
    body: {
      orderNumber,
      shippingCountryCode: shippingAddress.countryCode,
      shippingProvince: shippingAddress.state,
      shippingCity: shippingAddress.city,
      shippingAddress: shippingAddress.line1,
      shippingAddress2: shippingAddress.line2 || '',
      shippingCustomerName: shippingAddress.name,
      shippingZip: shippingAddress.postalCode,
      shippingPhone: shippingAddress.phone || '',
      products: items.map((item) => ({
        vid: item.cjVariantId,
        quantity: item.quantity
      }))
    }
  });
}

export async function getCjOrderStatus(cjOrderId) {
  return cjRequest('/shopping/order/getOrderDetail', { query: { orderId: cjOrderId } });
}

export async function getTracking(trackingNumber) {
  return cjRequest('/logistic/trackInfo', { query: { trackNumber: trackingNumber } });
}
