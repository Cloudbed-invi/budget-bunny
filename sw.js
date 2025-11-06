// Bunny Budget PWA service worker – GitHub Pages friendly
// v1: bump this string on each deploy to force an update
const CACHE_NAME = 'bb-app-v1';
const APP_SHELL = ['./index.html']; // keep repo-relative paths

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting(); // activate ASAP
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE_NAME ? null : caches.delete(k))));
    await self.clients.claim();
  })());
});

// Heuristics:
// - Navigations: network-first, fallback to cached index.html (for offline SPA)
// - Static same-origin GETs: stale-while-revalidate
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin
  if (url.origin !== self.location.origin) return;

  // Handle navigations (address bar, internal links)
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch {
        // offline fallback
        const cached = await caches.match('./index.html');
        return cached || Response.error();
      }
    })());
    return;
  }

  // Static assets: css/js/images/fonts/json/etc. – GET only
  if (req.method === 'GET') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      const network = fetch(req).then((resp) => {
        // update cache in background when successful
        if (resp && resp.status === 200) cache.put(req, resp.clone());
        return resp;
      }).catch(() => cached);

      // stale-while-revalidate: serve cached fast, refresh in background
      return cached || network;
    })());
  }
});
