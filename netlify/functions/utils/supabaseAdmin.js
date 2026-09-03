import { createClient } from '@supabase/supabase-js';

// Service-role Supabase client. This bypasses Row Level Security and must
// NEVER be imported by frontend code — it only exists inside Netlify
// Functions (server-side). SUPABASE_SERVICE_ROLE_KEY has no VITE_ prefix so
// Vite never bundles it into the browser build.
let client = null;

export function getSupabaseAdmin() {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Supabase admin credentials are not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).');
  }

  client = createClient(url, key, {
    auth: { persistSession: false }
  });
  return client;
}
