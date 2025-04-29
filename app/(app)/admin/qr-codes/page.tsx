'use client' // Make this a client component

import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react' // Import useState, useRef, and useEffect
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
import { Skeleton } from "../../../../components/ui/skeleton"

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
  const loadConfigs = async () => {
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
  };

  // Load configs on component mount
  useEffect(() => {
    loadConfigs();
  }, []); // Empty dependency array means run once on mount

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
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Manage QR Codes</h1>
        <Link href="/admin" className={buttonVariants({ variant: "outline", className: "bg-card hover:bg-accent/80" })}>Back to Admin</Link>
      </div>

      {/* Section to Generate New QR Code */}
      <Card className="mb-8 bg-card/80 dark:bg-card/80 backdrop-blur-lg border border-white/10 rounded-xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl text-foreground">Generate New QR Code</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="locationIdentifier" className="text-muted-foreground">Location Identifier</Label>
            <Input 
              id="locationIdentifier" 
              placeholder="e.g., Main Entrance, Floor 2 Breakroom" 
              value={locationIdentifier}
              onChange={(e) => setLocationIdentifier(e.target.value)}
              className="mt-1 border bg-input border-border rounded shadow-sm focus:outline-none focus:ring-primary focus:border-primary text-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">This identifier will be embedded in the QR code.</p>
          </div>
          <Button onClick={handleGenerate} className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <PlusCircleIcon className="h-5 w-5 mr-2"/>Generate Code
          </Button>
          {/* Area to display generated code */}
          <div ref={qrCodeRef} className="mt-4 p-4 border border-border rounded bg-muted/50 dark:bg-muted/50 min-h-[200px] flex items-center justify-center">
            {qrValue ? (
              <QRCode 
                value={qrValue} 
                size={160} 
                level="Q" 
                bgColor="#FFFFFF"
                fgColor="#000000"
              />
            ) : (
              <p className="text-muted-foreground text-center">Enter an identifier above and click 'Generate Code'.</p>
            )}
          </div>
          {/* Download/Save Buttons */}
          <div className="flex flex-wrap gap-2 mt-2">
             <Button variant="outline" onClick={handleDownload} disabled={!qrValue} className="bg-card hover:bg-accent/80 text-foreground">
                <ArrowDownTrayIcon className="h-5 w-5 mr-2"/> Download PNG
             </Button>
             <Button variant="outline" onClick={handleSave} disabled={!qrValue || isSaving} className="bg-card hover:bg-accent/80 text-foreground">
               {isSaving ? <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin"/> : <PlusCircleIcon className="h-5 w-5 mr-2"/>} 
               {isSaving ? 'Saving...' : 'Save Configuration'}
             </Button>
          </div>
        </CardContent>
      </Card>

      {/* Section to List Saved QR Codes */}
      <Card className="bg-card/80 dark:bg-card/80 backdrop-blur-lg border border-white/10 rounded-xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl text-foreground">Saved QR Code Configurations</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
               {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full bg-muted/50 dark:bg-muted/50 rounded-md" />)}
            </div>
          ) : savedConfigs.length === 0 ? (
            <p className="text-muted-foreground">No configurations saved yet.</p>
          ) : (
            <ul className="space-y-3">
              {savedConfigs.map((config) => (
                <li key={config.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 border border-border rounded hover:bg-accent/50 dark:hover:bg-accent/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-foreground">{config.location_identifier}</p>
                    <p className="text-xs text-muted-foreground truncate">Value: {config.qr_value}</p>
                    <p className="text-xs text-muted-foreground">Created: {new Date(config.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex space-x-2 flex-shrink-0">
                     <Button variant="outline" size="sm" onClick={() => loadSavedConfig(config)} disabled={isDeleting === config.id} className="bg-card hover:bg-accent/80">
                       Load
                     </Button>
                     <Button 
                       variant="destructive" 
                       size="sm" 
                       onClick={() => handleDelete(config.id)} 
                       disabled={isDeleting === config.id}
                       className="w-[80px]" // Give delete button fixed width
                     >
                       {isDeleting === config.id ? <ArrowPathIcon className="h-4 w-4 animate-spin"/> : <TrashIcon className="h-4 w-4"/>}
                       <span className="ml-1">{isDeleting === config.id ? '' : 'Delete'}</span>
                     </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

    </div>
  )
} 