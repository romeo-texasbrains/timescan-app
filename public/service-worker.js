// Service Worker for PWA and Push Notifications

// Cache version - CHANGE THIS VALUE WHEN DEPLOYING NEW VERSIONS
const CACHE_VERSION = 'v3';
const CACHE_NAME = `timescan-app-${CACHE_VERSION}`;

// Static assets cache
const STATIC_CACHE_NAME = `timescan-static-${CACHE_VERSION}`;

// API responses cache
const API_CACHE_NAME = `timescan-api-${CACHE_VERSION}`;

// Assets to cache
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/login',
  '/icons/txb icon-1.png',
  '/icons/txb icon-2.png',
  '/icons/txb icon-3.png',
  '/icons/txb icon-4.png',
  '/icons/txb icon-5.png',
  '/icons/txb icon-6.png',
  '/icons/txb icon-7.png',
  '/icons/txb icon-8.png',
  '/icons/txb icon-9.png',
];

// Install event - cache assets and force activation
self.addEventListener('install', (event) => {
  console.log(`Installing new service worker with cache: ${CACHE_VERSION}`);

  // Force the waiting service worker to become the active service worker
  self.skipWaiting();

  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(ASSETS_TO_CACHE);
      }),

      // Create API cache (empty initially)
      caches.open(API_CACHE_NAME).then((cache) => {
        console.log('Created API cache');
        return Promise.resolve();
      }),

      // Create main app cache (empty initially)
      caches.open(CACHE_NAME).then((cache) => {
        console.log('Created main app cache');
        return Promise.resolve();
      })
    ]).catch((error) => {
      console.error('Error during service worker installation:', error);
    })
  );
});

// Activate event - clean up old caches and claim clients
self.addEventListener('activate', (event) => {
  console.log(`Service worker activating with cache version: ${CACHE_VERSION}`);

  // Current cache names that should not be deleted
  const currentCaches = [
    CACHE_NAME,
    STATIC_CACHE_NAME,
    API_CACHE_NAME
  ];

  // Take control of all clients immediately
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!currentCaches.includes(cacheName)) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of uncontrolled clients
      self.clients.claim()
    ])
  );
});

// Fetch event - implement different strategies based on request type
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and requests from chrome-extension:// protocol
  if (event.request.method !== 'GET' ||
      event.request.url.startsWith('chrome-extension://') ||
      event.request.url.includes('/.well-known/')) {
    return;
  }

  const url = new URL(event.request.url);

  // Handle navigation requests - serve index.html for navigation requests that fail
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match('/offline.html');
        })
    );
    return;
  }

  // API requests - Network first with longer cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clone the response to store in cache
          const responseToCache = response.clone();

          // Update the API cache with the fresh response
          caches.open(API_CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            })
            .catch(err => console.error('Failed to update API cache:', err));

          return response;
        })
        .catch(error => {
          console.log('API fetch failed, falling back to cache:', error);
          // If network request fails, try to get from cache
          return caches.match(event.request, { cacheName: API_CACHE_NAME })
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // If no cached response, return a JSON error
              return new Response(
                JSON.stringify({ error: 'Network error', offline: true }),
                {
                  status: 503,
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            });
        })
    );
    return;
  }

  // Admin and management pages - Network first with fallback
  if (url.pathname.includes('/admin/') || url.pathname.includes('/mgmt/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clone the response to store in cache
          const responseToCache = response.clone();

          // Update the cache with the fresh response
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            })
            .catch(err => console.error('Failed to update cache:', err));

          return response;
        })
        .catch(error => {
          console.log('Admin/mgmt fetch failed, falling back to cache:', error);
          return caches.match(event.request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // If no cached response for admin/mgmt pages, redirect to offline page
              return caches.match('/offline.html');
            });
        })
    );
    return;
  }

  // Static assets (images, CSS, JS) - Cache first with network fallback
  if (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.gif') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2')
  ) {
    event.respondWith(
      caches.match(event.request, { cacheName: STATIC_CACHE_NAME })
        .then(cachedResponse => {
          if (cachedResponse) {
            // Return cached response
            return cachedResponse;
          }

          // If not in cache, fetch from network
          return fetch(event.request)
            .then(response => {
              // Check if valid response
              if (!response || response.status !== 200) {
                return response;
              }

              // Clone the response
              const responseToCache = response.clone();

              // Cache the response
              caches.open(STATIC_CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                })
                .catch(err => console.error('Failed to cache static asset:', err));

              return response;
            });
        })
    );
    return;
  }

  // Default strategy for everything else - Network first with cache fallback
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone the response to store in cache
        const responseToCache = response.clone();

        // Update the cache with the fresh response
        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(event.request, responseToCache);
          })
          .catch(err => console.error('Failed to update cache:', err));

        return response;
      })
      .catch(error => {
        console.log('Fetch failed, falling back to cache:', error);
        // If network request fails, try to get from cache
        return caches.match(event.request)
          .then(cachedResponse => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // If it's a navigation request, return the offline page
            if (event.request.mode === 'navigate') {
              return caches.match('/offline.html');
            }
            // Otherwise just let the error happen
            throw error;
          });
      })
  );
});

// Push event - handle push notifications
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  if (!event.data) {
    console.log('No data in push event');
    return;
  }

  try {
    // Parse the notification data
    const data = event.data.json();

    // Show notification
    const notificationPromise = self.registration.showNotification(
      data.title || 'TimeScan Notification',
      {
        body: data.body || 'You have a new notification',
        icon: data.icon || '/icons/txb icon-6.png',
        badge: '/icons/txb icon-6.png',
        data: data.data || {},
        vibrate: [100, 50, 100],
        actions: data.actions || [],
      }
    );

    event.waitUntil(notificationPromise);
  } catch (error) {
    console.error('Error handling push notification:', error);

    // Show a generic notification if parsing fails
    const notificationPromise = self.registration.showNotification(
      'TimeScan Notification',
      {
        body: 'You have a new notification',
        icon: '/icons/txb icon-6.png',
        badge: '/icons/txb icon-6.png',
        vibrate: [100, 50, 100],
      }
    );

    event.waitUntil(notificationPromise);
  }
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  event.notification.close();

  // Handle notification click - open the app
  event.waitUntil(
    clients.matchAll({ type: 'window' })
      .then((clientList) => {
        // If a window is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }

        // Otherwise, open a new window
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});
