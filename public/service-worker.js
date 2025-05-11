// Service Worker for PWA and Push Notifications

// Cache name
const CACHE_NAME = 'timescan-app-v1';

// Assets to cache
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/txb icon-6.png',
  // Add other assets to cache
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .catch((error) => {
        console.error('Error caching assets:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - serve from cache if available
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached response if found
        if (response) {
          return response;
        }
        
        // Clone the request
        const fetchRequest = event.request.clone();
        
        // Make network request
        return fetch(fetchRequest).then((response) => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clone the response
          const responseToCache = response.clone();
          
          // Cache the response
          caches.open(CACHE_NAME)
            .then((cache) => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
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
