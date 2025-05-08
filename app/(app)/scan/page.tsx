'use client'

import { useState } from 'react'
// Note: If using the beta version or a specific fork, adjust the import path if needed.
// Check your package.json for the exact name you installed.
import dynamic from 'next/dynamic';
import clsx from 'clsx';

// Define the status type (can be imported from QrScanner if exported there)
// Or defined locally if not exported
type ScanStatus = 'idle' | 'loading' | 'success' | 'error';

// Dynamically import the QrScanner component to avoid SSR issues
const QrScanner = dynamic(() => import('@/components/QrScanner'), { ssr: false });
// Removed unused supabase client import from here, as API handles auth
// import { createClient } from '@/lib/supabase/client'

export default function ScanPage() {
  // Replace old state with new status/message state
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [message, setMessage] = useState<string>('');
  const [isScanningActive, setIsScanningActive] = useState<boolean>(false); // State to control scanner visibility
  // const [scanResult, setScanResult] = useState<string | null>(null); // Removed
  // const [errorMessage, setErrorMessage] = useState<string | null>(null); // Removed
  // const [isLoading, setIsLoading] = useState<boolean>(false); // Removed

  // Updated handler to set status and message
  const handleScan = async (scannedText: string) => {
    if (status === 'loading') return; // Should technically not happen if scanner stops on load, but safe check.

    if (!scannedText) {
        setStatus('error');
        setMessage('Received empty scan data. Please try again.');
        setIsScanningActive(false); // Stop scanning on empty data
        return;
    };

    setStatus('loading');
    setMessage(''); // Scanner shows "Processing..."

    try {
      // Simulate network delay if needed for testing loading state
      // await new Promise(resolve => setTimeout(resolve, 1500));

      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCodeData: scannedText }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }
      setStatus('success');
      setMessage(data.message || `Successfully recorded event!`);
      setIsScanningActive(false); // Stop scanning after success

    } catch (error: unknown) {
      if (error instanceof Error) {
        setStatus('error');
        setMessage(`Error: ${error.message || 'Could not process scan.'}`);
      } else {
        setStatus('error');
        setMessage('An unknown error occurred.');
      }
      setIsScanningActive(false); // Stop scanning after error
    }
  };

  const startScanning = () => {
    setStatus('idle');
    setMessage('');
    setIsScanningActive(true);
  };

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-semibold mb-4">Scan Attendance QR Code</h1>

      {/* Scanner Area or Start Button */}
      <div className="relative w-full max-w-xs sm:max-w-sm border-2 border-dashed border-primary/30 dark:border-primary/30 rounded-xl overflow-hidden mb-6 aspect-square flex items-center justify-center bg-card/50 backdrop-blur-sm shadow-lg transition-all duration-300 hover:shadow-xl">
        {isScanningActive ? (
          // Render Scanner when active
          <div className="absolute inset-0 flex items-center justify-center">
            <QrScanner
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
          </div>
      )}

      {/* Removed old status display elements below scanner */}
      {/* {scanResult && <div className="text-green-600 font-semibold mb-2">{scanResult}</div>} */}
      {/* {errorMessage && <div className="text-red-600 mb-2">{errorMessage}</div>} */}
      {/* {isLoading && <div className="text-blue-500">Processing...</div>} */}
    </div>
  );
}
