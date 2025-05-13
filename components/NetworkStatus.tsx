'use client';

import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export default function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [showOfflineMessage, setShowOfflineMessage] = useState(false);
  const [showReconnectedMessage, setShowReconnectedMessage] = useState(false);

  useEffect(() => {
    // Set initial state
    setIsOnline(navigator.onLine);

    // Define event handlers
    const handleOnline = () => {
      setIsOnline(true);
      setShowOfflineMessage(false);
      setShowReconnectedMessage(true);
      
      // Hide the reconnected message after 3 seconds
      setTimeout(() => {
        setShowReconnectedMessage(false);
      }, 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowOfflineMessage(true);
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Clean up
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Don't render anything if online and no messages to show
  if (isOnline && !showReconnectedMessage) return null;

  return (
    <>
      {/* Offline message */}
      {showOfflineMessage && !isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-destructive text-destructive-foreground p-2 flex items-center justify-center shadow-md">
          <WifiOff size={16} className="mr-2" />
          <span className="text-sm font-medium">You're offline. Some features may be unavailable.</span>
        </div>
      )}

      {/* Reconnected message */}
      {showReconnectedMessage && isOnline && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-green-600 text-white p-2 flex items-center justify-center shadow-md animate-fade-in">
          <Wifi size={16} className="mr-2" />
          <span className="text-sm font-medium">You're back online!</span>
        </div>
      )}
    </>
  );
}
