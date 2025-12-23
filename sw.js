/* sw.js - Travel Plan PWA (MD) */
const VERSION = 'tp-md-v3-2025-12-23';
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
  try { await cache.put(req, res.clone()); } catch (_) {}
  return res;
}

async function networkFirstForNav(req) {
  try {
    const res = await fetch(req);
    const cache = await caches.open(RUNTIME_CACHE);
    try { await cache.put('./index.html', res.clone()); } catch (_) {}
    return res;
  } catch (e) {
    const cached = await caches.match('./index.html');
    return cached || new Response('offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }});
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;

  // SPA-like navigation fallback
  if (req.mode === 'navigate') {
    event.respondWith(networkFirstForNav(req));
    return;
  }

  // same-origin assets: cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // cross-origin: pass-through + best-effort cache
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      const cache = await caches.open(RUNTIME_CACHE);
      try { await cache.put(req, res.clone()); } catch (_) {}
      return res;
    } catch (e) {
      return cached || Response.error();
    }
  })());
});