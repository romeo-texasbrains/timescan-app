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
      <div className="relative w-full max-w-xs sm:max-w-sm border-2 border-dashed border-gray-400 rounded-lg overflow-hidden mb-4 aspect-square flex items-center justify-center">
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
          <button 
            onClick={startScanning}
            // Conditionally style the button based on the *previous* status
            className={clsx(
                "px-6 py-3 text-white font-semibold rounded-lg shadow transition-colors duration-200",
                status === 'success' && "bg-green-600 hover:bg-green-700",
                status === 'error' && "bg-red-600 hover:bg-red-700",
                status === 'idle' && "bg-blue-600 hover:bg-blue-700",
                // Add loading style? Button shouldn't strictly be clickable during load
            )}
          >
            {/* Change button text based on previous result */} 
            {status === 'success' ? 'Scan Again' : status === 'error' ? 'Try Scan Again' : 'Start Scanning'}
          </button>
        )}
      </div>

      {/* Display final status message *below* the button area if not scanning */}
      {!isScanningActive && message && (
          <p className={clsx(
              "text-sm mt-2 h-4 font-medium",
              status === 'success' && 'text-green-600',
              status === 'error' && 'text-red-600',
          )}>
              {message}
          </p>
      )}

      {/* Removed old status display elements below scanner */}
      {/* {scanResult && <div className="text-green-600 font-semibold mb-2">{scanResult}</div>} */}
      {/* {errorMessage && <div className="text-red-600 mb-2">{errorMessage}</div>} */}
      {/* {isLoading && <div className="text-blue-500">Processing...</div>} */}
    </div>
  );
}
