// A minimal service worker to make the app installable (PWA).

self.addEventListener('install', (event) => {
  // Skip waiting to activate the new SW immediately.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of all open clients immediately.
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass the network request through.
  // This is the simplest way to satisfy the PWA fetch event requirement.
  event.respondWith(fetch(event.request));
});