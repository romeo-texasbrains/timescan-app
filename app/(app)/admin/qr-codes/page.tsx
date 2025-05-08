'use client' // Make this a client component

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { useState, useRef, useEffect, useCallback } from 'react' // Import useState, useRef, and useEffect
import QRCode from 'react-qr-code' // Import the QR code component
import { saveAs } from 'file-saver'; // For downloading
import { createClient } from '@/lib/supabase/client' // Use client for potential saves later
import { saveQrConfig, deleteQrConfig } from '@/app/actions/qrActions' // Import server actions
import { Database } from '@/lib/supabase/database.types'
import toast from 'react-hot-toast'; // Import toast
// Import Heroicons directly from file paths to avoid barrel file issues
import TrashIcon from '@heroicons/react/24/outline/TrashIcon';
import ArrowPathIcon from '@heroicons/react/24/outline/ArrowPathIcon';
import ArrowDownTrayIcon from '@heroicons/react/24/outline/ArrowDownTrayIcon';
import PlusCircleIcon from '@heroicons/react/24/outline/PlusCircleIcon';
// Trying explicit relative path again for Skeleton - ensure this is correct
import { Skeleton } from "@/components/ui/skeleton"

const QR_CODE_PREFIX = "TIMESCAN-LOC:";

// Define type for saved config
type QrConfig = Database['public']['Tables']['qr_configs']['Row'];

export default function QrCodeManagementPage() {
  const supabase = createClient(); // Initialize client supabase
  const [locationIdentifier, setLocationIdentifier] = useState('');
  const [qrValue, setQrValue] = useState<string | null>(null); // The value to encode
  const qrCodeRef = useRef<HTMLDivElement>(null); // Ref for downloading
  const [savedConfigs, setSavedConfigs] = useState<QrConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true); // For loading saved configs
  const [isSaving, setIsSaving] = useState(false); // For save button state
  const [isDeleting, setIsDeleting] = useState<number | null>(null); // Store ID being deleted

  // Function to load saved configurations
  const loadConfigs = useCallback(async () => {
    setIsLoading(true);
    toast.dismiss(); // Clear toasts on load
    const { data, error } = await supabase
      .from('qr_configs')
      .select('id, location_identifier, qr_value, created_at, created_by')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error loading QR configs:", error);
      toast.error(`Load failed: ${error.message}`);
      setSavedConfigs([]);
    } else {
      setSavedConfigs(data || []);
    }
    setIsLoading(false);
  }, [supabase]); // Depend on supabase client instance

  // Load configs on component mount
  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]); // Now this dependency is stable

  const handleGenerate = () => {
    if (!locationIdentifier.trim()) {
      toast.error('Please enter a location identifier.');
      setQrValue(null);
      return;
    }
    setQrValue(`${QR_CODE_PREFIX}${locationIdentifier.trim()}`);
  };

  const handleDownload = () => {
      if (!qrCodeRef.current || !qrValue) return;

      // Access the SVG element within the QRCode component
      const svgElement = qrCodeRef.current.querySelector('svg');
      if (!svgElement) return;

      // Convert SVG to string
      const svgData = new XMLSerializer().serializeToString(svgElement);

      // Create a canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas size (slightly larger for padding/better quality)
      const desiredSize = 300; // Adjust as needed
      canvas.width = desiredSize;
      canvas.height = desiredSize;

      // Create an Image element
      const img = new Image();
      img.onload = () => {
          // Clear canvas and set background (optional)
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Draw the image onto the canvas (centered or scaled)
          // You might want to add padding or scale the image
          const padding = 20;
          const imgSize = desiredSize - 2 * padding;
          ctx.drawImage(img, padding, padding, imgSize, imgSize);

          // Convert canvas to PNG Blob
          canvas.toBlob((blob) => {
              if (blob) {
                  const filename = `qrcode-${locationIdentifier.trim().replace(/\s+/g, '-') || 'download'}.png`;
                  saveAs(blob, filename);
              }
          }, 'image/png');
      };
      img.onerror = (error) => {
          console.error("Error loading SVG image:", error);
          toast.error("Failed to generate PNG for download.");
      };
      // Set the SVG data as the image source
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleSave = async () => {
    if (!locationIdentifier?.trim() || !qrValue?.trim()) {
        toast.error('Cannot save. Generate QR first.');
        return;
    }
    setIsSaving(true);
    toast.dismiss();
    const result = await saveQrConfig(locationIdentifier, qrValue);
    setIsSaving(false);

    if (result.success) {
      toast.success(result.message || 'Configuration saved!');
      setLocationIdentifier('');
      setQrValue(null);
      await loadConfigs();
    } else {
      toast.error(result.message || 'Failed to save configuration.');
    }
  };

  const handleDelete = async (id: number) => {
      if (!confirm('Are you sure you want to delete this QR code configuration?')) {
          return;
      }
      setIsDeleting(id);
      toast.dismiss();
      const result = await deleteQrConfig(id);
      setIsDeleting(null);

      if (result.success) {
          toast.success(result.message || 'Configuration deleted!');
          await loadConfigs();
      } else {
          toast.error(result.message || 'Failed to delete configuration.');
      }
  };

  // Function to load a saved config into the generator
  const loadSavedConfig = (config: QrConfig) => {
      setLocationIdentifier(config.location_identifier);
      setQrValue(config.qr_value);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-8 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            <h1 className="text-2xl sm:text-3xl font-bold">Manage QR Codes</h1>
          </div>
          <p className="text-muted-foreground mt-1 ml-8">Create and manage QR codes for attendance scanning locations</p>
        </div>
        <Link
          href="/admin"
          className={buttonVariants({
            variant: "outline",
            className: "bg-card hover:bg-primary/10 border-border/50 text-foreground transition-colors flex items-center"
          })}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back to Admin
        </Link>
      </div>

      {/* Section to Generate New QR Code */}
      <Card className="mb-8 bg-card/80 dark:bg-card/80 backdrop-blur-lg border border-white/10 rounded-xl shadow-lg transition-all duration-300 hover:shadow-xl">
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <PlusCircleIcon className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-xl text-foreground">Generate New QR Code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          <div className="bg-primary/5 p-4 rounded-lg">
            <Label htmlFor="locationIdentifier" className="text-foreground font-medium">Location Identifier</Label>
            <div className="relative mt-2">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <Input
                id="locationIdentifier"
                placeholder="e.g., Main Entrance, Floor 2 Breakroom"
                value={locationIdentifier}
                onChange={(e) => setLocationIdentifier(e.target.value)}
                className="pl-10 border bg-card border-border/50 rounded-lg shadow-sm focus:ring-primary focus:border-primary text-foreground"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">This identifier will be embedded in the QR code and used for attendance tracking.</p>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={handleGenerate}
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all duration-300 hover:shadow-lg transform hover:scale-[1.02]"
            >
              <PlusCircleIcon className="h-5 w-5 mr-2"/>Generate QR Code
            </Button>
          </div>

          {/* Area to display generated code */}
          <div
            ref={qrCodeRef}
            className={`p-6 border-2 ${qrValue ? 'border-primary/30' : 'border-border/50'} rounded-xl bg-card min-h-[250px] flex items-center justify-center transition-all duration-300`}
          >
            {qrValue ? (
              <div className="flex flex-col items-center">
                <div className="bg-white p-4 rounded-xl shadow-md">
                  <QRCode
                    value={qrValue}
                    size={180}
                    level="Q"
                    bgColor="#FFFFFF"
                    fgColor="#000000"
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-4 text-center">
                  <span className="font-medium text-foreground">{locationIdentifier}</span>
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-muted-foreground/50 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                <p className="text-muted-foreground">Enter a location identifier above and click 'Generate QR Code'</p>
              </div>
            )}
          </div>

          {/* Download/Save Buttons */}
          <div className="flex flex-wrap gap-3 justify-center">
            <Button
              variant="outline"
              onClick={handleDownload}
              disabled={!qrValue}
              className="bg-card hover:bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 transition-colors flex-1 max-w-[200px]"
            >
              <ArrowDownTrayIcon className="h-5 w-5 mr-2"/> Download PNG
            </Button>
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={!qrValue || isSaving}
              className="bg-card hover:bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400 transition-colors flex-1 max-w-[200px]"
            >
              {isSaving ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin"/>
                  Saving...
                </>
              ) : (
                <>
                  <PlusCircleIcon className="h-5 w-5 mr-2"/>
                  Save Configuration
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Section to List Saved QR Codes */}
      <Card className="bg-card/80 dark:bg-card/80 backdrop-blur-lg border border-white/10 rounded-xl shadow-lg transition-all duration-300 hover:shadow-xl">
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <CardTitle className="text-xl text-foreground">Saved QR Code Configurations</CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-muted/20 rounded-lg p-4 animate-pulse">
                  <div className="flex items-center space-x-4">
                    <div className="h-12 w-12 bg-muted/30 rounded-lg"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted/30 rounded w-1/3"></div>
                      <div className="h-3 bg-muted/30 rounded w-1/2"></div>
                    </div>
                    <div className="flex space-x-2">
                      <div className="h-8 w-16 bg-muted/30 rounded"></div>
                      <div className="h-8 w-16 bg-muted/30 rounded"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : savedConfigs.length === 0 ? (
            <div className="bg-muted/10 rounded-lg p-8 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-muted-foreground font-medium">No QR code configurations saved yet</p>
              <p className="text-sm text-muted-foreground mt-1">Generate a QR code above and save it to see it here</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
              {savedConfigs.map((config) => (
                <div
                  key={config.id}
                  className="flex flex-col p-4 border border-border/50 rounded-lg hover:border-primary/30 bg-card/50 transition-all duration-300 hover:shadow-md"
                >
                  <div className="flex items-center mb-3">
                    <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="ml-3 flex-1 min-w-0">
                      <p className="font-medium truncate text-foreground">{config.location_identifier}</p>
                      <p className="text-xs text-muted-foreground truncate">{config.qr_value}</p>
                    </div>
                    <div className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                      Active
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground mb-4">
                    Created: {new Date(config.created_at).toLocaleDateString()} at {new Date(config.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>

                  <div className="flex space-x-2 mt-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadSavedConfig(config)}
                      disabled={isDeleting === config.id}
                      className="bg-card hover:bg-primary/10 border-primary/30 text-primary transition-colors flex-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                      Load
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(config.id)}
                      disabled={isDeleting === config.id}
                      className="bg-card hover:bg-destructive/10 border-destructive/30 text-destructive transition-colors flex-1"
                    >
                      {isDeleting === config.id ? (
                        <ArrowPathIcon className="h-4 w-4 animate-spin"/>
                      ) : (
                        <>
                          <TrashIcon className="h-4 w-4 mr-1"/>
                          Delete
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}