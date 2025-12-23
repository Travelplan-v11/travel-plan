/* Travel Plan - Service Worker (App Shell)
   Version bump to force update: change CACHE_NAME */
const CACHE_NAME = 'tp-md-v1';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './sw.js'
  // 若你的 icon 檔案在 repo 裡，建議也加進來：
  // './icon-192.png',
  // './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(CORE_ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : Promise.resolve())));
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 只處理同源
  if (url.origin !== self.location.origin) return;

  // Navigation: network-first (確保更新)
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match('./index.html')) || (await cache.match('./')) || new Response('Offline', { status: 200 });
      }
    })());
    return;
  }

  // Static: cache-first
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if (cached) return cached;

    try {
      const fresh = await fetch(req);
      // 只快取基本的 GET
      if (req.method === 'GET' && fresh && fresh.status === 200) {
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch {
      // 沒網路時，盡量回傳 core
      const fallback = await cache.match('./index.html');
      return fallback || new Response('', { status: 200 });
    }
  })());
});