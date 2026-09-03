import { getProduct } from './utils/cjClient.js';
import { json } from './utils/response.js';
import { isAuthorizedInternalRequest } from './utils/internalAuth.js';

const DEFAULT_TEST_PID = '2406110317591609800';

// Authenticates against CJ and fetches ONE real product (product/query) to
// confirm the whole chain works end-to-end. Returns only safe, non-cost
// product info — never the access token, never CJ's sell price (that's our
// cost, tracked separately and never exposed to customers — see
// supabase/migrations/0004_cj_supplier_data.sql).
export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return json(405, { message: 'Method not allowed' });
  }
  if (!isAuthorizedInternalRequest(event)) {
    return json(401, { message: 'Unauthorized' });
  }

  const pid = event.queryStringParameters?.cjProductId || DEFAULT_TEST_PID;

  try {
    const response = await getProduct(pid);
    const p = response?.data;

    if (!p) {
      return json(200, {
        success: false,
        message: response?.message || 'CJ returned no product data for this ID.'
      });
    }

    return json(200, {
      success: true,
      message: 'CJ authentication and product lookup succeeded.',
      product: {
        cjProductId: p.pid,
        name: Array.isArray(p.productName) ? p.productName[0] : p.productName,
        nameEn: p.productNameEn,
        sku: p.productSku,
        categoryName: p.categoryName,
        status: p.status,
        productType: p.productType,
        imageUrl: p.productImage,
        variantCount: Array.isArray(p.variants) ? p.variants.length : 0,
        variants: Array.isArray(p.variants)
          ? p.variants.map((v) => ({
              vid: v.vid,
              sku: v.variantSku,
              name: v.variantNameEn || v.variantName,
              property: v.variantProperty,
              image: v.variantImage
            }))
          : []
      }
    });
  } catch (err) {
    console.error('[cj-test]', err.message);
    return json(200, {
      success: false,
      message: err.message
    });
  }
}
