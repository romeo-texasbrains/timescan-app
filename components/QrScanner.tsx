"use client";
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import clsx from 'clsx';

type ScanStatus = 'idle' | 'loading' | 'success' | 'error';

interface QrScannerProps {
  onScan: (scannedText: string) => void;
  externalStatus?: ScanStatus;
  externalMessage?: string;
}

const QrScanner = ({ onScan, externalStatus = 'idle', externalMessage }: QrScannerProps) => {
  const qrRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const hasScannedRef = useRef(false);

  const [internalStatus, setInternalStatus] = useState<ScanStatus>('idle');
  const [internalMessage, setInternalMessage] = useState<string>('');

  const finalStatus = externalStatus !== 'idle' ? externalStatus : internalStatus;
  const finalMessage = externalStatus !== 'idle' ? externalMessage : internalMessage;

  useEffect(() => {
    // Reset internal state when external status changes
    if (externalStatus === 'success' || externalStatus === 'error' || externalStatus === 'idle') {
       if (internalStatus === 'loading') {
           setInternalStatus('idle');
           setInternalMessage('');
       }
    }

    // Reset hasScannedRef when component is in idle state
    // This allows scanning again after a successful or failed scan
    if (externalStatus === 'idle' && finalStatus === 'idle') {
      hasScannedRef.current = false;
    }
  }, [externalStatus, internalStatus, finalStatus]);

  useEffect(() => {
    if (finalStatus === 'idle' && !externalMessage) {
        setInternalMessage('Point your camera at the QR code.');
    }

    // Don't initialize if element isn't ready or scanner already exists
    if (!qrRef.current || html5QrCodeRef.current) return;

    // Create a mounted flag to track component lifecycle
    let isMounted = true;

    // Get element ID for scanner initialization
    const elementId = qrRef.current.id;

    // Initialize scanner
    const html5QrCode = new Html5Qrcode(elementId);
    html5QrCodeRef.current = html5QrCode;

    const qrCodeSuccessCallback = async (decodedText: string) => {
      // Prevent processing if already scanned or component unmounted
      if (hasScannedRef.current || !isMounted) return;

      // Mark as scanned to prevent duplicate processing
      hasScannedRef.current = true;

      // Update internal state
      if (isMounted) {
        setInternalStatus('loading');
        setInternalMessage('Processing scan...');
      }

      // Safely stop scanner before calling onScan
      try {
        if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
          // Only clear if component is still mounted
          if (isMounted && html5QrCodeRef.current) {
            html5QrCodeRef.current.clear();
          }
        }
      } catch (err) {
        console.error("Error stopping scanner after successful scan:", err);
      }

      // Only call onScan if component is still mounted
      if (isMounted) {
        onScan(decodedText);
      }
    };

    const qrCodeErrorCallback = (error: any) => {
      // Only log errors if component is still mounted
      if (isMounted) {
        // Filter out common non-critical errors that occur during normal scanning
        const errorString = error?.toString() || '';

        // Skip logging for common non-critical errors that happen during normal scanning
        const isNormalScanningError =
          // "Not found" errors (normal during scanning)
          errorString.includes('NotFoundException') ||
          errorString.includes('No MultiFormat Readers were able to detect the code') ||

          // Canvas/image processing errors (can happen during initialization or when camera is adjusting)
          errorString.includes('getImageData') ||
          errorString.includes('IndexSizeError') ||
          errorString.includes('The source width is 0') ||

          // Media errors that can happen during normal usage
          errorString.includes('AbortError') ||
          errorString.includes('play() request was interrupted');

        // Only log errors that aren't part of the normal scanning process
        if (!isNormalScanningError) {
          console.error("QR Scan Error:", error);
        }
      }
    };

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
      disableFlip: false,
    };

    // Start scanner with error handling
    html5QrCode
      .start(
        { facingMode: "environment" },
        config,
        qrCodeSuccessCallback,
        qrCodeErrorCallback
      )
      .catch((err) => {
        // Only update state if component is still mounted
        if (isMounted) {
          console.error("Html5Qrcode start error:", err);
          setInternalStatus('error');
          setInternalMessage('Error: Could not start camera. Check permissions.');
        }
      });

    // Cleanup function
    return () => {
      // Mark component as unmounted
      isMounted = false;

      // Get current scanner instance
      const scanner = html5QrCodeRef.current;

      // Clear ref immediately to prevent multiple cleanup attempts
      html5QrCodeRef.current = null;

      // Only attempt cleanup if scanner exists
      if (scanner) {
        // Use a safe cleanup approach
        const safeCleanup = async () => {
          try {
            // Check if scanning before attempting to stop
            if (scanner.isScanning) {
              try {
                await scanner.stop();
                console.log("QR Scanner stopped successfully.");
              } catch (stopErr) {
                // Ignore specific errors about scanner not running
                if (!stopErr.toString().includes("Cannot stop, scanner is not running")) {
                  console.error("Error stopping QR Scanner:", stopErr);
                }
              }
            }

            // Always attempt to clear the HTML elements
            try {
              scanner.clear();
              console.log("QR Scanner cleared successfully.");
            } catch (clearErr) {
              // Ignore common errors during cleanup
              const clearErrStr = clearErr.toString();
              const isCommonCleanupError =
                // DOM-related errors
                clearErrStr.includes("removeChild") ||
                clearErrStr.includes("Node") ||
                // Canvas-related errors
                clearErrStr.includes("getImageData") ||
                clearErrStr.includes("IndexSizeError") ||
                clearErrStr.includes("source width is 0") ||
                // Media-related errors
                clearErrStr.includes("AbortError") ||
                clearErrStr.includes("play() request was interrupted");

              if (!isCommonCleanupError) {
                console.error("Error clearing QR Scanner:", clearErr);
              }
            }
          } catch (err) {
            console.error("General error during QR scanner cleanup:", err);
          }
        };

        // Execute cleanup
        safeCleanup();
      }
    };
  }, [finalMessage, finalStatus, onScan]);

  return (
    <div className="flex flex-col items-center justify-center w-full h-full">
      <div
        id="qr-reader"
        ref={qrRef}
        className={clsx(
          "w-full max-w-[300px] sm:max-w-[400px] aspect-square",
          "relative rounded-xl shadow-lg border-2 bg-black overflow-hidden",
          "transition-all duration-300 ease-in-out",
          finalStatus === 'idle' && 'border-primary/30 dark:border-primary/30',
          finalStatus === 'loading' && 'border-primary animate-pulse scale-[1.02]',
          finalStatus === 'success' && 'border-green-500 scale-[1.02]',
          finalStatus === 'error' && 'border-destructive scale-[1.02]'
        )}
      >
        {/* Scanner frame corners for visual effect */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary/70 rounded-tl-lg"></div>
        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary/70 rounded-tr-lg"></div>
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary/70 rounded-bl-lg"></div>
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary/70 rounded-br-lg"></div>

        {/* Scanning animation */}
        {finalStatus === 'idle' && (
          <div className="absolute inset-x-0 top-0 h-1 bg-primary/50 animate-scan"></div>
        )}

        {/* Status overlays */}
        {(finalStatus === 'loading' || (finalStatus === 'error' && finalMessage) || finalStatus === 'success') && (
            <div className={clsx(
              "absolute inset-0 backdrop-blur-sm flex items-center justify-center p-4",
              finalStatus === 'loading' && 'bg-black/50',
              finalStatus === 'success' && 'bg-green-500/20',
              finalStatus === 'error' && 'bg-destructive/20'
            )}>
                <div className="bg-card/90 p-4 rounded-lg shadow-lg border border-white/10 max-w-[90%]">
                  <p className="text-foreground text-center text-lg font-semibold">
                    {finalStatus === 'loading' ? 'Processing...' : finalMessage}
                  </p>
                </div>
            </div>
        )}
      </div>
      <p className={clsx(
          "text-sm mt-4 h-5 text-center font-medium",
          "transition-all duration-300",
          finalStatus === 'idle' && 'text-muted-foreground',
          finalStatus === 'loading' && 'text-primary animate-pulse',
          finalStatus === 'success' && 'text-green-500',
          finalStatus === 'error' && 'text-destructive'
        )}>
          {(finalStatus === 'idle' && !externalMessage) ? internalMessage : (finalStatus !== 'idle' ? finalMessage : '')}
        </p>
    </div>
  );
};

export default QrScanner;
