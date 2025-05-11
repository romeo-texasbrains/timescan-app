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
          const registration = await navigator.serviceWorker.register('/service-worker.js');
          console.log('Service Worker registered with scope:', registration.scope);
          
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
