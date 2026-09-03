import { testAuthentication } from './utils/cjClient.js';
import { json } from './utils/response.js';
import { isAuthorizedInternalRequest } from './utils/internalAuth.js';

// Verifies CJ_EMAIL + CJ_API_KEY work by calling ONLY
// authentication/getAccessToken — nothing else. Does not touch products,
// inventory, or orders. Never returns the access token, refresh token, or
// the CJ_API_KEY itself — only non-sensitive metadata (token expiry dates)
// so you can confirm the exchange succeeded.
export async function handler(event) {
  if (event.httpMethod !== 'GET') {
    return json(405, { message: 'Method not allowed' });
  }
  if (!isAuthorizedInternalRequest(event)) {
    return json(401, { message: 'Unauthorized' });
  }

  try {
    const result = await testAuthentication();
    return json(200, {
      success: true,
      message: 'CJ authentication succeeded.',
      accessTokenExpiryDate: result.accessTokenExpiryDate,
      refreshTokenExpiryDate: result.refreshTokenExpiryDate
    });
  } catch (err) {
    console.error('[cj-test-auth]', err.message);
    return json(200, {
      success: false,
      message: err.message
    });
  }
}
