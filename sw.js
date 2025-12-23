/* sw.js - Travel Plan PWA
   - App shell cache
   - Runtime cache for CDN + API calls
   - Offline fallback for navigations (serves index.html)
*/

const VERSION = 'tp-pwa-v1.0.0';
const STATIC_CACHE = `static-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './sw.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(APP_SHELL);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
        .map(k => caches.delete(k))
    );
    self.clients.claim();
  })());
});

// Simple helpers
async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  const cache = await caches.open(RUNTIME_CACHE);
  try { await cache.put(req, res.clone()); } catch (_) {}
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req).then(async (res) => {
    try { await cache.put(req, res.clone()); } catch (_) {}
    return res;
  }).catch(() => null);
  return cached || (await fetchPromise) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GET
  if (req.method !== 'GET') return;

  // App shell: navigation requests -> index.html (offline-friendly SPA behavior)
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        // Network-first for navigations (keeps it fresh)
        const res = await fetch(req);
        const cache = await caches.open(RUNTIME_CACHE);
        try { await cache.put('./index.html', res.clone()); } catch (_) {}
        return res;
      } catch (e) {
        // Offline fallback
        const cached = await caches.match('./index.html');
        return cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  // Same-origin static resources -> cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Cross-origin (CDN / API) -> stale-while-revalidate
  // This helps offline load for Vue/Tailwind/Fonts after first successful visit.
  event.respondWith(staleWhileRevalidate(req));
});