/* sw.js - Travel Plan PWA
   - App shell cache
   - Runtime cache for CDN/API (stale-while-revalidate)
   - Offline fallback for navigations
*/
const VERSION = 'tp-pwa-v2.0.0';
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

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  const cache = await caches.open(RUNTIME_CACHE);
  try { cache.put(req, res.clone()); } catch (_) {}
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req).then((res) => {
    try { cache.put(req, res.clone()); } catch (_) {}
    return res;
  }).catch(() => null);

  return cached || (await fetchPromise) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;

  // Navigations -> index.html (keeps it SPA/PWA friendly on Pages)
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(RUNTIME_CACHE);
        try { cache.put('./index.html', res.clone()); } catch (_) {}
        return res;
      } catch (e) {
        const cached = await caches.match('./index.html');
        return cached || new Response('offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  // Same-origin -> cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Cross-origin (CDN / API) -> stale-while-revalidate
  event.respondWith(staleWhileRevalidate(req));
});