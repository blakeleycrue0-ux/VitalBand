// ============================================================================
// CJdropshipping API v2 client (server-side only — netlify/functions/**).
//
// Verified against CJ's own documentation search index PLUS the actual
// source code of two independently-published, currently-maintained npm
// packages that implement this same API end-to-end (@shopnex/cj-plugin and
// a multi-provider dropshipping client) — CJ's docs site itself blocks
// automated fetches from this environment, so real working client code was
// used to cross-check every endpoint/field below instead of guessing:
//   - Base URL:        https://developers.cjdropshipping.com/api2.0/v1
//   - Auth endpoint:   POST /authentication/getAccessToken
//                       body: { email, password }  — `password` is the API
//                       key from CJ Personal Center → API → Get API Key.
//                       BOTH fields are required — CJ's API does not accept
//                       the API key alone.
//   - Auth header on all other requests: CJ-Access-Token: <accessToken>
//   - Token lifetime:  access token 15 days, refresh token 180 days
//   - Rate limit:      1 request/second (QPS = 1); error code 1600200 means
//                       the limit was exceeded
//   - Response envelope: { code, result: boolean, message, data, requestId }
// ============================================================================

const BASE_URL = 'https://developers.cjdropshipping.com/api2.0/v1';

// Human-readable text for CJ's documented error codes, so failures surface
// as something meaningful instead of a bare number.
const CJ_ERROR_MESSAGES = {
  1600000: 'System busy. Please try again later.',
  1600001: 'No permission — CJ-Access-Token is invalid.',
  1600002: 'CJ-Access-Token not found.',
  1600003: 'Refresh token failed.',
  1600100: 'This interface has been taken offline.',
  1600101: 'Interface not found — check the endpoint URL.',
  1600200: 'Call exceeded the rate limit — try again shortly.',
  1600201: 'API quota has been used up.',
  1600300: 'Illegal parameter.',
  1601000: 'User not found — check the CJ account email.',
  1602000: 'Variant not found.',
  1602001: 'Product not found or offline.',
  1603000: 'Order creation failed.',
  1603001: 'Order confirmation failed.',
  1603002: 'Order deletion failed.',
  1603100: 'Order not found.',
  1603101: 'Order payment failed.',
  1604000: 'Insufficient CJ account balance.',
  1605000: 'Logistics option not found.'
};

function cjErrorMessage(data, fallback) {
  if (data?.message) return data.message;
  if (data?.code && CJ_ERROR_MESSAGES[data.code]) return CJ_ERROR_MESSAGES[data.code];
  return fallback;
}

let cachedToken = null;
let cachedTokenExpiry = 0;

// Exchanges CJ_EMAIL + CJ_API_KEY for an access token. Never logs or returns
// the credential itself — only the resulting token (which is itself
// sensitive and stays server-side).
async function requestAccessToken() {
  const email = process.env.CJ_EMAIL;
  const apiKey = process.env.CJ_API_KEY;

  if (!email || !apiKey) {
    const missing = [!email && 'CJ_EMAIL', !apiKey && 'CJ_API_KEY'].filter(Boolean).join(', ');
    throw new Error(`Missing CJ credential(s) in environment variables: ${missing}`);
  }

  const res = await fetch(`${BASE_URL}/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: apiKey })
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || data?.result === false || !data?.data?.accessToken) {
    throw new Error(cjErrorMessage(data, `CJ authentication failed (HTTP ${res.status})`));
  }

  return data.data; // { accessToken, accessTokenExpiryDate, refreshToken, refreshTokenExpiryDate, createDate }
}

// Calls CJ's getAccessToken fresh, bypassing the in-memory cache — used only
// by the dedicated auth-test function so a test always reflects the real
// current credentials rather than a cached result.
export async function testAuthentication() {
  const tokenData = await requestAccessToken();
  return {
    accessTokenExpiryDate: tokenData.accessTokenExpiryDate,
    refreshTokenExpiryDate: tokenData.refreshTokenExpiryDate,
    createDate: tokenData.createDate
  };
}

async function getAccessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiry) {
    return cachedToken;
  }
  const tokenData = await requestAccessToken();
  cachedToken = tokenData.accessToken;
  // Cache in-memory for this warm function instance only, well under CJ's
  // real 15-day access-token lifetime.
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
    throw new Error(cjErrorMessage(data, `CJ API error on ${path} (HTTP ${res.status})`));
  }

  return data;
}

export async function getProduct(cjProductId) {
  return cjRequest('/product/query', { query: { pid: cjProductId } });
}

export async function getVariantInventory(cjVariantId) {
  return cjRequest('/product/stock/queryByVid', { query: { vid: cjVariantId } });
}

// Request shape confirmed against real client-library source (CreateOrderPayload).
// Uses createOrderV2 — the current endpoint (the older createOrder and a
// newer createOrderV3 both also exist; V2 is what current integrations use).
export async function createCjOrder({ orderNumber, shippingAddress, items }) {
  return cjRequest('/shopping/order/createOrderV2', {
    method: 'POST',
    body: {
      orderNumber,
      shippingCountryCode: shippingAddress.countryCode,
      shippingCountry: shippingAddress.country || shippingAddress.countryCode,
      shippingProvince: shippingAddress.state,
      shippingCity: shippingAddress.city,
      shippingAddress: shippingAddress.line1,
      shippingAddress2: shippingAddress.line2 || '',
      shippingCustomerName: shippingAddress.name,
      shippingZip: shippingAddress.postalCode,
      shippingPhone: shippingAddress.phone || '',
      email: shippingAddress.email,
      fromCountryCode: 'CN',
      logisticName: shippingAddress.logisticName || 'CJPacket Ordinary',
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
  return cjRequest('/logistic/trackInfo', { query: { trackingNumber } });
}
