'use client'

import { useState, useEffect } from 'react'
// Note: If using the beta version or a specific fork, adjust the import path if needed.
// Check your package.json for the exact name you installed.
import dynamic from 'next/dynamic';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';

// Define the status type (can be imported from QrScanner if exported there)
// Or defined locally if not exported
type ScanStatus = 'idle' | 'loading' | 'success' | 'error';

// Dynamically import the new React Webcam QR Scanner component
const QrScanner = dynamic(() => import('@/components/ReactWebcamQrScanner'), { ssr: false });
// Import the client error boundary wrapper
import ClientErrorBoundary from '@/components/ClientErrorBoundary';
// Removed unused supabase client import from here, as API handles auth
// import { createClient } from '@/lib/supabase/client'

export default function ScanPage() {
  const router = useRouter();

  // Replace old state with new status/message state
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [message, setMessage] = useState<string>('');
  const [isScanningActive, setIsScanningActive] = useState<boolean>(false); // State to control scanner visibility
  const [redirectTimer, setRedirectTimer] = useState<NodeJS.Timeout | null>(null); // Timer for redirection
  const [shouldRedirect, setShouldRedirect] = useState<boolean>(false); // Flag to track if we should redirect

  // Effect to handle redirection after successful scan
  useEffect(() => {
    // If we have a success status, set up redirection
    if (status === 'success' && !shouldRedirect) {
      // Set the redirect flag
      setShouldRedirect(true);

      // Show success message for 3 seconds before redirecting
      const timer = setTimeout(() => {
        // Navigate to homepage
        try {
          console.log('Redirecting to homepage after successful scan...');
          router.push('/');
        } catch (error) {
          console.error('Navigation error:', error);
          // If navigation fails, try a hard redirect
          window.location.href = '/';
        }
      }, 3000); // Increased to 3 seconds to ensure success message is visible

      // Store the timer so we can clear it if needed
      setRedirectTimer(timer);
    }

    // Cleanup function to clear the timer if component unmounts
    return () => {
      if (redirectTimer) {
        clearTimeout(redirectTimer);
      }
    };
  }, [status, shouldRedirect, router, redirectTimer]);

  // Safety net - only redirect if we're not in a success state
  useEffect(() => {
    // Set up a safety timeout to redirect after 30 seconds, but only if we're not in a success state
    const safetyTimer = setTimeout(() => {
      if (window.location.pathname.includes('/scan') && status !== 'success') {
        console.log('Safety timeout: Redirecting to homepage...');
        try {
          router.push('/');
        } catch (error) {
          console.error('Safety redirect error:', error);
          window.location.href = '/';
        }
      }
    }, 30000); // 30 seconds - increased to give more time for scanning

    // Clean up the timer
    return () => clearTimeout(safetyTimer);
  }, [router, status]);

  // Updated handler to set status and message with better error handling
  const handleScan = async (scannedText: string) => {
    // Prevent processing if already in loading state
    if (status === 'loading') return;

    // Handle empty scan data
    if (!scannedText || typeof scannedText !== 'string' || scannedText.trim() === '') {
        console.log('Empty scan data received');
        setStatus('error');
        setMessage('Received empty scan data. Please try again.');

        // Use setTimeout to ensure component has time to update state before unmounting
        setTimeout(() => {
          setIsScanningActive(false); // Stop scanning on empty data
        }, 100);
        return;
    }

    console.log('QR code scanned successfully, processing...');

    // Set loading state
    setStatus('loading');
    setMessage(''); // Scanner shows "Processing..."

    // Use a timeout to prevent API request from hanging indefinitely
    const apiTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('API request timeout')), 8000)
    );

    try {
      // Make API request with timeout
      const apiRequest = fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCodeData: scannedText.trim() }),
      });

      // Race between the API request and the timeout
      const response = await Promise.race([apiRequest, apiTimeout]) as Response;

      // Parse response
      const data = await response.json();

      // Handle error responses
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      console.log('Scan processed successfully:', data.message || 'Success');

      // Handle success
      setStatus('success');
      setMessage(data.message || `Successfully recorded event!`);

      // Show success message for at least 1.5 seconds before stopping scanner
      setTimeout(() => {
        // Update message to include redirect info
        setMessage(prev => prev + ' Redirecting to homepage...');

        // Stop scanning after showing success message
        setTimeout(() => {
          setIsScanningActive(false); // Stop scanning after success
        }, 500);
      }, 1500);

    } catch (error: unknown) {
      // Handle errors
      console.error('Error processing scan:', error);

      if (error instanceof Error) {
        setStatus('error');
        setMessage(`Error: ${error.message || 'Could not process scan.'}`);
      } else {
        setStatus('error');
        setMessage('An unknown error occurred.');
      }

      // Important: Use setTimeout to ensure component has time to clean up properly
      // before removing it from the DOM
      setTimeout(() => {
        setIsScanningActive(false); // Stop scanning after error
      }, 100);

      // Safety redirect after error
      setTimeout(() => {
        if (window.location.pathname.includes('/scan')) {
          console.log('Safety redirect after error');
          try {
            router.push('/');
          } catch (navError) {
            window.location.href = '/';
          }
        }
      }, 5000);
    }
  };

  const startScanning = () => {
    console.log('Starting QR scanner...');

    // Reset state before activating scanner
    setStatus('idle');
    setMessage('');
    setShouldRedirect(false);

    // Clear any existing redirect timers
    if (redirectTimer) {
      clearTimeout(redirectTimer);
      setRedirectTimer(null);
    }

    // Use setTimeout to ensure state updates are processed before mounting the scanner
    setTimeout(() => {
      setIsScanningActive(true);
    }, 100);

    // Safety timeout - if scanner doesn't activate within 3 seconds, try again
    const safetyTimer = setTimeout(() => {
      if (!isScanningActive) {
        console.log('Scanner failed to activate, retrying...');
        setIsScanningActive(true);
      }
    }, 3000);

    // Clean up safety timer after 5 seconds
    setTimeout(() => clearTimeout(safetyTimer), 5000);
  };

  return (
    <ClientErrorBoundary>
      <div className="flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-semibold mb-4">Scan Attendance QR Code</h1>

        {/* Scanner Area or Start Button */}
        <div className="relative w-full max-w-xs sm:max-w-sm border-2 border-dashed border-primary/30 dark:border-primary/30 rounded-xl overflow-hidden mb-6 aspect-square flex items-center justify-center bg-card/50 backdrop-blur-sm shadow-lg transition-all duration-300 hover:shadow-xl">
          {isScanningActive ? (
            // Render Scanner when active
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Key prop forces component to remount when scanning is reactivated */}
              <QrScanner
                key={`scanner-${Date.now()}`}
                onScan={handleScan}
                externalStatus={status}
                externalMessage={message}
              />
            </div>
          ) : (
            // Render Start Button when inactive
            <div className="flex flex-col items-center justify-center p-4 text-center">
              <div className="mb-4 text-primary/70">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <p className="text-muted-foreground mb-4">Ready to scan attendance QR code</p>
              <button
                onClick={startScanning}
                className={clsx(
                  "px-6 py-3 font-semibold rounded-lg shadow-md transition-all duration-300 transform hover:scale-105",
                  status === 'success' && "bg-green-600 hover:bg-green-700 text-white",
                  status === 'error' && "bg-destructive hover:bg-destructive/90 text-destructive-foreground",
                  status === 'idle' && "bg-primary hover:bg-primary/90 text-primary-foreground",
                )}
              >
                {/* Change button text based on previous result */}
                {status === 'success' ? 'Scan Again' : status === 'error' ? 'Try Scan Again' : 'Start Scanning'}
              </button>
            </div>
          )}
        </div>

        {/* Display final status message *below* the button area if not scanning */}
        {!isScanningActive && message && (
            <div className={clsx(
                "p-4 rounded-lg shadow-md border text-center max-w-xs mx-auto transition-all duration-300",
                status === 'success' && 'bg-green-500/10 border-green-500/30 text-green-600',
                status === 'error' && 'bg-destructive/10 border-destructive/30 text-destructive',
            )}>
                <p className="font-medium">{message}</p>
                {status === 'success' && (
                  <p className="text-sm text-muted-foreground mt-2">
                    You will be redirected to the homepage in a moment...
                  </p>
                )}
                {status === 'error' && (
                  <div className="mt-3">
                    <button
                      onClick={() => router.push('/')}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm"
                    >
                      Return to Homepage
                    </button>
                  </div>
                )}
            </div>
        )}

        {/* Home button for safety */}
        <div className="mt-8">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 transition-colors text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Return to Homepage
          </button>
        </div>
      </div>
    </ClientErrorBoundary>
  );
}
