// sw.js — 75 Hard PWA Service Worker
// Cache strategy: cache-first for app shell, network-first for icons CDN

const CACHE_NAME = '75hard-v5';

// Files that make up the app shell (all served locally)
const APP_SHELL = [
  './track.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// External CDN resources to cache on first fetch
const CDN_HOSTS = [
  'cdn.jsdelivr.net',
];

// ── Install: pre-cache the app shell ─────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Pre-caching app shell');
      return cache.addAll(APP_SHELL);
    })
  );
  // Take control immediately without waiting for old SW to be evicted
  self.skipWaiting();
});

// ── Activate: delete old caches ───────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    )
  );
  // Claim all open clients so the new SW takes over immediately
  self.clients.claim();
});

// ── Fetch: cache-first with network fallback ──────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  // Skip chrome-extension and non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // Serve from cache; also revalidate in the background for CDN assets
        if (CDN_HOSTS.includes(url.hostname)) {
          fetch(event.request)
            .then(response => {
              if (response && response.status === 200) {
                caches.open(CACHE_NAME).then(c => c.put(event.request, response.clone()));
              }
            })
            .catch(() => {/* ignore network errors during background revalidation */});
        }
        return cached;
      }

      // Not in cache — fetch from network and cache the result
      return fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // Offline fallback: serve the main app HTML for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('./track.html');
          }
        });
    })
  );
});

// ── Push notifications (optional — used by Telegram webhook later) ───────────
self.addEventListener('push', event => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: '75 Hard', body: event.data.text() };
  }

  const options = {
    body: payload.body || 'Time to check your tasks!',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: payload.tag || '75hard-reminder',
    renotify: true,
    data: { url: payload.url || './track.html' },
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || '75 Hard', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || './track.html';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('track.html') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
