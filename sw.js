// Bunny Budget PWA service worker – with activation toast
// Bump VERSION and CACHE_NAME on each deploy
const VERSION = 'v1.0.6';
const CACHE_NAME = 'bb-shell-v4';
const RELEASE_NOTE = 'Icon update for mobiles';

const APP_SHELL = ['./index.html']; // repo-relative for GitHub Pages

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting(); // activate ASAP
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Purge old caches
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))));
    await self.clients.claim();

    // Announce the new version to all open pages (your page shows a toast)
    const clientsArr = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsArr) {
      client.postMessage({
        type: 'SW_ACTIVATED',
        version: VERSION,
        note: RELEASE_NOTE,
        ts: Date.now()
      });
    }
  })());
});

// Network strategy:
// - Navigations: network-first, fallback to cached index.html (offline SPA)
// - Same-origin static GETs: stale-while-revalidate
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();

  // NEW: reply with current version/note when asked
  if (data.type === 'PING') {
    event.source?.postMessage({ type: 'SW_STATUS', version: VERSION, note: RELEASE_NOTE });
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Always fetch the latest manifest so icon changes propagate
  if (req.url.endsWith('manifest.json')) {
    return; // let the browser handle it with normal HTTP caching
  }
  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Navigations (address bar / internal links)
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_NAME);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch {
        const cached = await caches.match('./index.html');
        return cached || Response.error();
      }
    })());
    return;
  }

  // Static GET assets
  if (req.method === 'GET') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      const network = fetch(req).then((resp) => {
        if (resp && resp.status === 200) {
          cache.put(req, resp.clone());
        }
        return resp;
      }).catch(() => cached);

      // Serve cached fast, refresh in background
      return cached || network;
    })());
  }
});

// Support an optional "update now" button in your UI
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
