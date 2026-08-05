import { createClient } from '@supabase/supabase-js';
import { config, isSupabaseConfigured } from './config.js';

// A single browser-side Supabase client, using only the public anon key.
// Row Level Security (see supabase/migrations) governs exactly what this
// client is allowed to read. It can never read customers/orders — those
// exist only behind Netlify Functions using the service role key.
export const supabase = isSupabaseConfigured()
  ? createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { persistSession: false }
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
  }
  return supabase;
}
