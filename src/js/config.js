// Public, browser-safe configuration only. Every value here is read from
// import.meta.env.VITE_* — Vite refuses to expose anything without that
// prefix to client code, so this file can never leak server secrets.
export const config = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  stripePublishableKey: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '',
  notificationsEnabled: (import.meta.env.VITE_NOTIFICATIONS_ENABLED ?? 'true') === 'true',
  notificationsMode: import.meta.env.VITE_NOTIFICATIONS_MODE || 'demo',
  productSlug: 'smart-bracelet'
};

export const isSupabaseConfigured = () =>
  Boolean(config.supabaseUrl && config.supabaseAnonKey);
