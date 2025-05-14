'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GlobalErrorHandler() {
  const router = useRouter();

  useEffect(() => {
    // Set up a safety net - if we're on the scan page, always redirect after a timeout
    let safetyRedirectTimer: NodeJS.Timeout | null = null;

    if (window.location.pathname.includes('/scan')) {
      safetyRedirectTimer = setTimeout(() => {
        // If we're still on the scan page after 25 seconds, redirect to home
        if (window.location.pathname.includes('/scan')) {
          console.log('Safety redirect: Still on scan page after timeout, redirecting to homepage...');
          try {
            router.push('/');
          } catch (error) {
            window.location.href = '/';
          }
        }
      }, 25000); // 25 seconds safety timeout - increased to give more time for scanning
    }

    // Function to handle unhandled errors
    const handleGlobalError = (event: ErrorEvent) => {
      console.error('Global error caught:', event.error);

      // Check if the error is related to the QR scanner or DOM
      const errorMessage = event.error?.toString() || '';

      // CRITICAL FIX: Handle known errors specifically
      if (errorMessage.includes('localeCompare is not a function') ||
          errorMessage.includes('a.name.localeCompare is not a function')) {
        console.error('Caught localeCompare error - this is a known issue with department sorting');

        // Prevent the default error handling to avoid crashing the app
        event.preventDefault();

        // Set a flag in localStorage to indicate we've seen this error
        try {
          localStorage.setItem('localeCompareErrorSeen', 'true');
        } catch (e) {
          // Ignore localStorage errors
        }

        // Try to reload the page after a short delay
        setTimeout(() => {
          try {
            window.location.reload();
          } catch (reloadError) {
            console.error('Failed to reload after localeCompare error:', reloadError);
          }
        }, 1000);

        return true;
      }

      // Handle "Objects are not valid as a React child" error
      if (errorMessage.includes('Objects are not valid as a React child')) {
        console.error('Caught "Objects are not valid as a React child" error - this is likely due to trying to render an object directly');

        // Prevent the default error handling to avoid crashing the app
        event.preventDefault();

        // Try to reload the page after a short delay
        setTimeout(() => {
          try {
            window.location.reload();
          } catch (reloadError) {
            console.error('Failed to reload after React child error:', reloadError);
          }
        }, 1000);

        return true;
      }

      const isQrScannerError =
        errorMessage.includes('removeChild') ||
        errorMessage.includes('Node') ||
        errorMessage.includes('getImageData') ||
        errorMessage.includes('IndexSizeError') ||
        errorMessage.includes('source width is 0') ||
        errorMessage.includes('AbortError') ||
        errorMessage.includes('play() request was interrupted');

      // More aggressive error handling - redirect on any error if we're on the scan page
      if (window.location.pathname.includes('/scan')) {
        console.log('Error detected on scan page, redirecting to homepage...');

        // Show a toast or notification if available
        try {
          // @ts-ignore - Assuming you have a global toast function
          if (typeof toast !== 'undefined') {
            toast.info('Your scan may have been processed. Redirecting to homepage...');
          }
        } catch (e) {
          // Ignore toast errors
        }

        // Redirect immediately for QR scanner errors, short delay for others
        const delay = isQrScannerError ? 100 : 1000;

        setTimeout(() => {
          try {
            router.push('/');
          } catch (navError) {
            console.error('Navigation error:', navError);
            // Fallback to direct location change
            window.location.href = '/';
          }
        }, delay);

        // Prevent the default error handling
        event.preventDefault();
        return true;
      }

      // Let other errors be handled normally
      return false;
    };

    // Add the global error handler
    window.addEventListener('error', handleGlobalError);

    // Also handle unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);

      // If we're on the scan page, redirect to home
      if (window.location.pathname.includes('/scan')) {
        console.log('Unhandled promise rejection on scan page, redirecting to homepage...');

        setTimeout(() => {
          try {
            router.push('/');
          } catch (navError) {
            console.error('Navigation error:', navError);
            window.location.href = '/';
          }
        }, 500);

        // Prevent default handling
        event.preventDefault();
        return true;
      }

      return false;
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Cleanup
    return () => {
      if (safetyRedirectTimer) {
        clearTimeout(safetyRedirectTimer);
      }
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [router]);

  // This component doesn't render anything
  return null;
}
