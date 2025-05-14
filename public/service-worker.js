// Redirect to the correct service worker file
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', function(event) {
  if (event.request.url.endsWith('/service-worker.js')) {
    // Redirect to the correct service worker file
    event.respondWith(fetch('/sw.js'));
  }
});
