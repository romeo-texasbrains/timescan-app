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
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop()
          .then(() => {
            if (html5QrCodeRef.current) {
                 html5QrCodeRef.current.clear();
            }
            console.log("QR Scanner stopped.");
          })
          .catch((err) => {
            console.error("Error stopping QR Scanner:", err);
          })
          .finally(() => {
              html5QrCodeRef.current = null; 
          });
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
          "relative rounded shadow border-2 bg-black overflow-hidden",
          finalStatus === 'idle' && 'border-gray-300 dark:border-gray-600',
          finalStatus === 'loading' && 'border-blue-500 animate-pulse',
          finalStatus === 'success' && 'border-green-500',
          finalStatus === 'error' && 'border-red-500'
        )}
      >
        {(finalStatus === 'loading' || (finalStatus === 'error' && finalMessage)) && (
            <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4">
                <p className="text-white text-center text-lg font-semibold">
                  {finalStatus === 'loading' ? 'Processing...' : finalMessage}
                </p>
            </div>
        )}
      </div>
      <p className={clsx(
          "text-xs mt-3 h-4 text-center",
          finalStatus === 'idle' && 'text-gray-500 dark:text-gray-400',
          finalStatus === 'loading' && 'text-blue-500 animate-pulse',
          finalStatus === 'success' && 'text-green-600 font-medium',
          finalStatus === 'error' && 'text-red-600 font-medium'
        )}>
          {(finalStatus === 'idle' && !externalMessage) ? internalMessage : (finalStatus !== 'idle' ? finalMessage : '')}
        </p>
    </div>
  );
};

export default QrScanner;
