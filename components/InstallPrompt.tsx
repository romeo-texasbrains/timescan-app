'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function InstallPrompt() {
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed or prompt was previously dismissed
    const checkInstallState = () => {
      // Check if running as standalone PWA
      const standalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as any).standalone || 
                         document.referrer.includes('android-app://');
      
      setIsStandalone(standalone);
      
      // Check if on iOS
      const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      setIsIOS(iOS);
      
      // Check if user previously dismissed the prompt
      const promptDismissed = localStorage.getItem('pwaPromptDismissed');
      if (promptDismissed) {
        const dismissedTime = parseInt(promptDismissed, 10);
        const now = Date.now();
        // If dismissed more than 7 days ago, show again
        if (now - dismissedTime > 7 * 24 * 60 * 60 * 1000) {
          localStorage.removeItem('pwaPromptDismissed');
        } else {
          setDismissed(true);
        }
      }
    };
    
    checkInstallState();
    
    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent Chrome 76+ from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later
      setInstallPromptEvent(e as BeforeInstallPromptEvent);
      // Show the prompt after a delay
      setTimeout(() => {
        if (!isStandalone && !dismissed) {
          setShowPrompt(true);
        }
      }, 3000); // Show after 3 seconds
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // Cleanup
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isStandalone, dismissed]);
  
  const handleInstallClick = async () => {
    if (!installPromptEvent) return;
    
    // Show the install prompt
    installPromptEvent.prompt();
    
    // Wait for the user to respond to the prompt
    const choiceResult = await installPromptEvent.userChoice;
    
    // Reset the deferred prompt variable
    setInstallPromptEvent(null);
    setShowPrompt(false);
    
    // If user dismissed, remember for 7 days
    if (choiceResult.outcome === 'dismissed') {
      localStorage.setItem('pwaPromptDismissed', Date.now().toString());
    }
  };
  
  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwaPromptDismissed', Date.now().toString());
  };
  
  if (!showPrompt || isStandalone) return null;
  
  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 p-4 bg-card border border-border rounded-lg shadow-lg animate-fade-in">
      <button 
        onClick={handleDismiss}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        <X size={18} />
      </button>
      
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <img src="/icons/txb icon-6.png" alt="TimeScan" className="w-12 h-12 rounded-lg" />
        </div>
        <div className="flex-grow">
          <h3 className="font-semibold text-foreground">Install TimeScan</h3>
          {isIOS ? (
            <p className="text-sm text-muted-foreground">
              Tap <span className="inline-flex items-center"><svg className="w-4 h-4 mx-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg></span> 
              then "Add to Home Screen" to install
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Install this app on your device for quick access
            </p>
          )}
        </div>
        
        {!isIOS && (
          <button
            onClick={handleInstallClick}
            className="flex-shrink-0 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Install
          </button>
        )}
      </div>
    </div>
  );
}
