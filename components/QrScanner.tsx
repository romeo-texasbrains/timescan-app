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
    if (externalStatus === 'success' || externalStatus === 'error' || externalStatus === 'idle') {
       if (internalStatus === 'loading') {
           setInternalStatus('idle');
           setInternalMessage('');
       }
    }
  }, [externalStatus, internalStatus]);

  useEffect(() => {
    if (finalStatus === 'idle' && !externalMessage) {
        setInternalMessage('Point your camera at the QR code.');
    }

    if (!qrRef.current || html5QrCodeRef.current) return;

    const elementId = qrRef.current.id;
    const html5QrCode = new Html5Qrcode(elementId);
    html5QrCodeRef.current = html5QrCode;

    const qrCodeSuccessCallback = async (decodedText: string) => {
      if (hasScannedRef.current) return;
      hasScannedRef.current = true;
      setInternalStatus('loading');
      setInternalMessage('Processing scan...');
      if (html5QrCodeRef.current) {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      }
      onScan(decodedText);
    };

    const qrCodeErrorCallback = (error: any) => {
      console.error("QR Scan Error:", error);
    };

    const config = {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0,
      disableFlip: false,
    };

    html5QrCode
      .start(
        { facingMode: "environment" },
        config,
        qrCodeSuccessCallback,
        qrCodeErrorCallback
      )
      .catch((err) => {
        console.error("Html5Qrcode start error:", err);
        setInternalStatus('error');
        setInternalMessage('Error: Could not start camera. Check permissions.');
      });

    return () => {
      const scanner = html5QrCodeRef.current;
      if (scanner) {
        // Store reference to scanner before clearing the ref
        const scannerInstance = scanner;

        // Clear the ref immediately to prevent multiple cleanup attempts
        html5QrCodeRef.current = null;

        if (scannerInstance.isScanning) {
          scannerInstance.stop()
            .then(() => {
              try {
                scannerInstance.clear();
                console.log("QR Scanner stopped and cleared.");
              } catch (clearErr) {
                console.error("Error clearing QR Scanner:", clearErr);
              }
            })
            .catch((err) => {
              console.error("Error stopping QR Scanner:", err);
              // Try to clear anyway
              try {
                scannerInstance.clear();
              } catch (clearErr) {
                console.error("Error clearing QR Scanner after stop error:", clearErr);
              }
            });
        } else {
          // If not scanning, just try to clear
          try {
            scannerInstance.clear();
            console.log("QR Scanner cleared (was not scanning).");
          } catch (clearErr) {
            console.error("Error clearing QR Scanner (was not scanning):", clearErr);
          }
        }
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
