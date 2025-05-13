'use client';

import { useEffect } from 'react';
import { registerForPushNotifications, saveSubscription } from '@/lib/utils/pushNotifications';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', async () => {
        try {
          // Register service worker
          const registration = await navigator.serviceWorker.register('/service-worker.js', {
            updateViaCache: 'none' // Don't use browser cache for service worker updates
          });
          console.log('Service Worker registered with scope:', registration.scope);

          // Check for updates immediately
          registration.update();

          // Set up periodic update checks
          setInterval(() => {
            registration.update();
            console.log('Checking for service worker updates...');
          }, 60 * 60 * 1000); // Check every hour

          // Handle updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('Service worker update found!');

            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('New service worker installed, reloading for updates...');
                  // Optional: Show a notification to the user before reloading
                  window.location.reload();
                }
              });
            }
          });

          // Register for push notifications if supported
          if ('PushManager' in window) {
            try {
              // Check if notifications are already granted
              if (Notification.permission === 'granted') {
                const subscription = await registerForPushNotifications();
                if (subscription) {
                  await saveSubscription(subscription);
                }
              }
            } catch (error) {
              console.error('Error registering for push notifications:', error);
            }
          }
        } catch (error) {
          console.error('Service Worker registration failed:', error);
        }
      });
    }
  }, []);

  return null;
}
