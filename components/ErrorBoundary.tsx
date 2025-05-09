'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export default function ErrorBoundary({
  children,
  fallback = <DefaultErrorFallback />
}: ErrorBoundaryProps) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Set up a safety net - if we're on the scan page, always redirect after a timeout
    let safetyRedirectTimer: NodeJS.Timeout | null = null;

    if (window.location.pathname.includes('/scan') && !hasError) {
      safetyRedirectTimer = setTimeout(() => {
        // If we're still on the scan page after 20 seconds, trigger error fallback
        if (window.location.pathname.includes('/scan')) {
          console.log('Safety timeout: Triggering error fallback...');
          setHasError(true);
        }
      }, 20000); // 20 seconds safety timeout - increased to give more time for scanning
    }

    const errorHandler = (event: ErrorEvent) => {
      console.error('Error caught by boundary:', event.error);
      setHasError(true);

      // Prevent the error from bubbling up
      event.preventDefault();
    };

    // Add global error handler
    window.addEventListener('error', errorHandler);

    // Also handle unhandled promise rejections
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection caught by boundary:', event.reason);
      setHasError(true);

      // Prevent default handling
      event.preventDefault();
    };

    window.addEventListener('unhandledrejection', rejectionHandler);

    // Cleanup
    return () => {
      if (safetyRedirectTimer) {
        clearTimeout(safetyRedirectTimer);
      }
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', rejectionHandler);
    };
  }, [hasError]);

  if (hasError) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

function DefaultErrorFallback() {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5); // Increased countdown time

  useEffect(() => {
    // Immediate redirect attempt for scan page
    if (window.location.pathname.includes('/scan')) {
      console.log('Error boundary triggered on scan page, attempting immediate redirect...');

      // Try to redirect immediately
      try {
        router.push('/');
      } catch (error) {
        console.error('Immediate navigation error:', error);
        // If immediate navigation fails, we'll still have the countdown as backup
      }
    }

    // Start countdown for auto-redirect as backup
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Navigate to homepage
          try {
            router.push('/');
          } catch (error) {
            console.error('Navigation error:', error);
            // If navigation fails, try a hard redirect
            window.location.href = '/';
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Safety timeout - force redirect after 5 seconds no matter what
    const safetyTimeout = setTimeout(() => {
      window.location.href = '/';
    }, 5000);

    return () => {
      clearInterval(timer);
      clearTimeout(safetyTimeout);
    };
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center p-4 text-center">
      <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-6 max-w-md">
        <h2 className="text-xl font-semibold text-destructive mb-2">Something went wrong</h2>
        <p className="mb-4 text-muted-foreground">
          We encountered an error, but your scan may have been processed successfully.
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          Redirecting to homepage in {countdown} seconds...
        </p>
        <button
          onClick={() => {
            try {
              router.push('/');
            } catch (error) {
              window.location.href = '/';
            }
          }}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Go to Homepage Now
        </button>
      </div>
    </div>
  );
}
