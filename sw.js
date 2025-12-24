/* sw.js - simple offline cache for GitHub Pages (Travel Plan)
   - app shell: cache-first
   - APIs (OSM/OSRM/ER-API): network-first
   - navigation fallback -> index.html
*/
const CACHE_VERSION = "v12.2.3";
const CACHE_PREFIX = "travel-plan-md3-";
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

function getBasePath() {
  // e.g. https://<host>/<repo>/  -> "/<repo>/"
  const p = new URL(self.registration.scope).pathname;
  return p.endsWith("/") ? p : (p + "/");
}

self.addEventListener("install", (event) => {
  const BASE = getBasePath();
  const CORE_ASSETS = [
    BASE,
    BASE + "index.html",
    BASE + "manifest.webmanifest",
    BASE + "icon-192.png",
    BASE + "icon-512.png",
    BASE + "sw.js",
  ];

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => {
          if (k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME) return caches.delete(k);
          return null;
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GET
  if (req.method !== "GET") return;

  // Network-first for APIs (geocode/routing/exchange rate)
  if (
    url.hostname.includes("openstreetmap.org") ||
    url.hostname.includes("nominatim.openstreetmap.org") ||
    url.hostname.includes("router.project-osrm.org") ||
    url.hostname.includes("open.er-api.com") ||
    url.hostname.includes("er-api.com")
  ) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // Cache-first for app shell & static files
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(async () => {
          // For SPA navigation/offline fallback
          if (req.mode === "navigate") {
            const BASE = getBasePath();
            return caches.match(BASE + "index.html");
          }
          return undefined;
        });
    })
  );
});
