import { config } from './config.js';
import { supabase } from './supabaseClient.js';

// Reusable "live activity" notification widget.
//
// DEMO mode (VITE_NOTIFICATIONS_MODE=demo): shows simulated, generic
// activity messages generated entirely client-side. These are never
// presented as specific real purchases/people — no fabricated names,
// timestamps or locations, just the kind of ambient copy called out in the
// product brief.
//
// LIVE mode (VITE_NOTIFICATIONS_MODE=live): shows ONLY real rows inserted
// into the `notification_events` table (is_demo = false) by server-side
// Netlify Functions when a genuine event happens (e.g. a real checkout).
// Nothing is invented in this mode.
const DEMO_MESSAGES = [
  'Someone just added the Smart Bracelet to their cart.',
  'Black is currently one of our most popular colors.',
  '12 people are viewing this product right now.',
  'Rose Gold has been trending this week.',
  'Free shipping is included on every order.'
];

function escapeHtml(str = '') {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function initNotifications() {
  if (!config.notificationsEnabled) return;

  const stack = document.getElementById('notification-stack');
  if (!stack) return;

  const queue = [];
  let showing = false;

  function pushToast(message) {
    queue.push(message);
    if (!showing) drainQueue();
  }

  function drainQueue() {
    const message = queue.shift();
    if (!message) {
      showing = false;
      return;
    }
    showing = true;
    renderToast(message);
  }

  function renderToast(message) {
    const el = document.createElement('div');
    el.className = 'notification-toast';
    el.setAttribute('role', 'status');
    el.innerHTML = `
      <span class="notification-dot" aria-hidden="true"></span>
      <div>
        <div class="notification-text">${escapeHtml(message)}</div>
      </div>
      <button type="button" class="notification-close" aria-label="Dismiss">&times;</button>
    `;
    stack.appendChild(el);
    requestAnimationFrame(() => el.classList.add('is-visible'));

    const visibleMs = randomBetween(4000, 6000);
    const remove = () => {
      el.classList.add('is-leaving');
      el.classList.remove('is-visible');
      setTimeout(() => {
        el.remove();
        drainQueue();
      }, 320);
    };

    const timer = setTimeout(remove, visibleMs);
    el.querySelector('.notification-close').addEventListener('click', () => {
      clearTimeout(timer);
      remove();
    });
  }

  function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  if (config.notificationsMode === 'live' && supabase) {
    initLiveMode(pushToast);
  } else {
    initDemoMode(pushToast);
  }
}

function initDemoMode(pushToast) {
  function scheduleNext() {
    const delay = randomBetweenGlobal(8000, 15000);
    setTimeout(() => {
      const message = DEMO_MESSAGES[Math.floor(Math.random() * DEMO_MESSAGES.length)];
      pushToast(message);
      scheduleNext();
    }, delay);
  }
  scheduleNext();
}

function randomBetweenGlobal(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function initLiveMode(pushToast) {
  // Show only genuine events already recorded, then subscribe for new ones.
  supabase
    .from('notification_events')
    .select('message, created_at')
    .eq('is_demo', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .then(({ data }) => {
      if (data && data[0]) pushToast(data[0].message);
    });

  supabase
    .channel('notification_events_live')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notification_events' },
      (payload) => {
        if (payload.new && payload.new.is_demo === false) {
          pushToast(payload.new.message);
        }
      }
    )
    .subscribe();
}
