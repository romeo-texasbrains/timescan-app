'use client';

import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function UpdateNotification() {
  const [newVersionAvailable, setNewVersionAvailable] = useState(false);
  
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    
    // Function to check for updates
    const checkForUpdates = async () => {
      try {
        // Get all service worker registrations
        const registrations = await navigator.serviceWorker.getRegistrations();
        
        if (registrations.length === 0) return;
        
        // For each registration, check for updates
        for (const registration of registrations) {
          // Force an update check
          const updateResult = await registration.update();
          
          // Listen for the updatefound event
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            
            if (!newWorker) return;
            
            // Listen for state changes on the new worker
            newWorker.addEventListener('statechange', () => {
              // If the new service worker is installed but waiting
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('New version available!');
                setNewVersionAvailable(true);
                
                // Show a toast notification
                toast.info(
                  <div className="flex flex-col gap-2">
                    <div className="font-medium">App update available</div>
                    <div className="text-sm">Refresh to get the latest version</div>
                    <button 
                      onClick={() => window.location.reload()} 
                      className="mt-2 bg-primary text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw size={14} />
                      Update Now
                    </button>
                  </div>,
                  {
                    duration: Infinity,
                    id: 'app-update',
                  }
                );
              }
            });
          });
        }
      } catch (error) {
        console.error('Error checking for updates:', error);
      }
    };
    
    // Check for updates on mount
    checkForUpdates();
    
    // Set up periodic update checks (every 30 minutes)
    const intervalId = setInterval(checkForUpdates, 30 * 60 * 1000);
    
    // Clean up
    return () => clearInterval(intervalId);
  }, []);
  
  // This component doesn't render anything visible
  // It just shows toast notifications when updates are available
  return null;
}
