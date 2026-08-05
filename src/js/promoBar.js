import { supabase } from './supabaseClient.js';

// A real, configurable countdown — never a fake timer that just resets on
// every page load. It reads `site_settings.promo` = { enabled, message,
// code, end_at } from Supabase. `end_at` is a real ISO timestamp you set
// (e.g. the actual end of a real discount window). If it's missing, in the
// past, or disabled, the bar simply doesn't render. Update `end_at` in
// Supabase whenever you run a new time-limited promotion.
const DISMISS_KEY = 'vitalband:promo-dismissed';

export async function initPromoBar() {
  const bar = document.getElementById('promo-bar');
  if (!bar || !supabase) return;

  if (sessionStorage.getItem(DISMISS_KEY)) return;

  const { data, error } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'promo')
    .maybeSingle();

  if (error || !data?.value) return;

  const promo = data.value;
  if (!promo.enabled || !promo.end_at) return;

  const endTime = new Date(promo.end_at).getTime();
  if (Number.isNaN(endTime) || endTime <= Date.now()) return;

  const messageEl = document.getElementById('promo-message');
  const countdownEl = document.getElementById('promo-countdown');
  const closeBtn = document.getElementById('promo-close');

  messageEl.innerHTML = promo.code
    ? `${escapeHtml(promo.message || '')} <strong>${escapeHtml(promo.code)}</strong>`
    : escapeHtml(promo.message || '');

  bar.hidden = false;
  document.body.classList.add('has-promo-bar');

  function tick() {
    const remaining = endTime - Date.now();
    if (remaining <= 0) {
      bar.hidden = true;
      document.body.classList.remove('has-promo-bar');
      clearInterval(timer);
      return;
    }
    countdownEl.textContent = formatRemaining(remaining);
  }

  const timer = setInterval(tick, 1000);
  tick();

  closeBtn.addEventListener('click', () => {
    bar.hidden = true;
    document.body.classList.remove('has-promo-bar');
    clearInterval(timer);
    sessionStorage.setItem(DISMISS_KEY, '1');
  });
}

function formatRemaining(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n) => String(n).padStart(2, '0');
  if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function escapeHtml(str = '') {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
