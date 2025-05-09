'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import jsQR from 'jsqr';
import clsx from 'clsx';

type ScanStatus = 'idle' | 'loading' | 'success' | 'error';

interface QrScannerProps {
  onScan: (scannedText: string) => void;
  externalStatus?: ScanStatus;
  externalMessage?: string;
}

const ReactWebcamQrScanner = ({ onScan, externalStatus = 'idle', externalMessage }: QrScannerProps) => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const hasScannedRef = useRef(false);

  const [internalStatus, setInternalStatus] = useState<ScanStatus>('idle');
  const [internalMessage, setInternalMessage] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isWebcamReady, setIsWebcamReady] = useState(false);

  const finalStatus = externalStatus !== 'idle' ? externalStatus : internalStatus;
  const finalMessage = externalStatus !== 'idle' ? externalMessage : internalMessage;

  // Reset internal state when external status changes
  useEffect(() => {
    if (externalStatus === 'success' || externalStatus === 'error' || externalStatus === 'idle') {
      if (internalStatus === 'loading') {
        setInternalStatus('idle');
        setInternalMessage('');
      }
    }

    // Reset hasScannedRef when component is in idle state
    if (externalStatus === 'idle' && finalStatus === 'idle') {
      hasScannedRef.current = false;
    }

    // When external status is success, make sure we don't keep scanning
    if (externalStatus === 'success') {
      hasScannedRef.current = true;
    }
  }, [externalStatus, internalStatus, finalStatus]);

  // Set initial message
  useEffect(() => {
    if (finalStatus === 'idle' && !externalMessage) {
      setInternalMessage('Point your camera at the QR code.');
    }
  }, [finalStatus, externalMessage]);

  // Handle webcam ready state
  const handleWebcamReady = useCallback(() => {
    setIsWebcamReady(true);
  }, []);

  // Function to capture and process frames
  const captureAndProcessFrame = useCallback(() => {
    if (hasScannedRef.current || finalStatus !== 'idle') {
      // Don't process frames if we've already scanned or not in idle state
      return;
    }

    const webcam = webcamRef.current;
    const canvas = canvasRef.current;

    if (webcam && canvas && isWebcamReady) {
      const video = webcam.video;

      if (video && video.readyState === 4) {
        // Get video dimensions
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;

        // Set canvas dimensions to match video
        canvas.width = videoWidth;
        canvas.height = videoHeight;

        // Draw video frame to canvas
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, videoWidth, videoHeight);

          // Get image data for QR code scanning
          try {
            const imageData = ctx.getImageData(0, 0, videoWidth, videoHeight);

            // Scan for QR code
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            });

            // If QR code found
            if (code) {
              // Mark as scanned to prevent duplicate processing
              hasScannedRef.current = true;

              // Update internal state
              setInternalStatus('loading');
              setInternalMessage('Processing scan...');

              // Call onScan callback with the QR code data
              onScan(code.data);
            }
          } catch (error) {
            // Silently ignore processing errors - they're common during scanning
            // and we don't want to spam the console
          }
        }
      }
    }

    // Continue scanning
    requestRef.current = requestAnimationFrame(captureAndProcessFrame);
  }, [isWebcamReady, finalStatus, onScan]);

  // Start/stop scanning based on component mount/unmount
  useEffect(() => {
    // Start scanning when webcam is ready
    if (isWebcamReady && finalStatus === 'idle') {
      requestRef.current = requestAnimationFrame(captureAndProcessFrame);
    }

    // Cleanup function
    return () => {
      // Cancel animation frame on unmount
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [isWebcamReady, captureAndProcessFrame, finalStatus]);

  // Toggle camera (front/back)
  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  return (
    <div className="flex flex-col items-center justify-center w-full h-full">
      <div
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
        {/* Hidden canvas for processing */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Webcam component */}
        <div className="absolute inset-0">
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={{
              facingMode,
              aspectRatio: 1
            }}
            onUserMedia={handleWebcamReady}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Scanner frame corners for visual effect */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary/70 rounded-tl-lg"></div>
        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary/70 rounded-tr-lg"></div>
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary/70 rounded-bl-lg"></div>
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary/70 rounded-br-lg"></div>

        {/* Scanning animation */}
        {finalStatus === 'idle' && (
          <div className="absolute inset-x-0 top-0 h-1 bg-primary/50 animate-scan"></div>
        )}

        {/* Camera toggle button */}
        {finalStatus === 'idle' && (
          <button
            onClick={toggleCamera}
            className="absolute bottom-3 right-3 p-2 bg-black/50 rounded-full text-white"
            aria-label="Toggle camera"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}

        {/* Status overlays */}
        {(finalStatus === 'loading' || (finalStatus === 'error' && finalMessage) || finalStatus === 'success') && (
          <div className={clsx(
            "absolute inset-0 backdrop-blur-sm flex items-center justify-center p-4",
            finalStatus === 'loading' && 'bg-black/50',
            finalStatus === 'success' && 'bg-green-500/20',
            finalStatus === 'error' && 'bg-destructive/20'
          )}>
            <div className={clsx(
              "p-4 rounded-lg shadow-lg border max-w-[90%] transition-all duration-300",
              finalStatus === 'success' && 'bg-green-500/90 border-green-400 animate-pulse',
              finalStatus === 'error' && 'bg-destructive/80 border-destructive/50',
              finalStatus === 'loading' && 'bg-card/90 border-white/10'
            )}>
              {finalStatus === 'success' && (
                <div className="flex flex-col items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <p className="text-white text-center text-lg font-semibold">
                    {finalMessage}
                  </p>
                </div>
              )}
              {finalStatus !== 'success' && (
                <p className="text-foreground text-center text-lg font-semibold">
                  {finalStatus === 'loading' ? 'Processing...' : finalMessage}
                </p>
              )}
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

export default ReactWebcamQrScanner;
