/* sw.js - GitHub Pages friendly (project site) */
const CACHE_VERSION = "travel-plan-v1.0.6";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE_VERSION ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

// Network-first for navigations (HTML), cache-first for others
self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  // Handle top-level navigations
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        // Always try the network first for HTML
        const fresh = await fetch(req, { cache: "no-store" });
        const cache = await caches.open(CACHE_VERSION);
        // cache the shell under "./"
        cache.put("./", fresh.clone());
        return fresh;
      } catch (e) {
        const cached = await caches.match("./");
        return cached || new Response("Offline", { status: 503 });
      }
    })());
    return;
  }

  // Static assets: cache-first
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;

    try {
      const fresh = await fetch(req);
      const cache = await caches.open(CACHE_VERSION);
      cache.put(req, fresh.clone());
      return fresh;
    } catch (e) {
      return cached || new Response("Offline", { status: 503 });
    }
  })());
});