'use client';

import { useState, useRef } from 'react';
import { Profile } from '@/lib/types/profile';
import { uploadHealthCard } from '@/lib/utils/profileUploads';
import { updateHealthCardUrl } from '@/app/actions/profileActions';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { DocumentIcon, DocumentPlusIcon } from '@heroicons/react/24/outline';

interface HealthCardUploadProps {
  profile: Profile;
}

export default function HealthCardUpload({ profile }: HealthCardUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(
    profile.health_card_url 
      ? profile.health_card_url.split('/').pop() || 'Health Card' 
      : null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type (image or PDF)
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error('Please select an image or PDF file');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size should be less than 5MB');
      return;
    }

    // Set the file name
    setFileName(file.name);

    // Upload the file
    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Authentication error. Please log in again.');
        return;
      }

      const uploadedUrl = await uploadHealthCard(supabase, user.id, file);
      if (!uploadedUrl) {
        toast.error('Error uploading health card');
        return;
      }

      // Update the profile with the new URL
      const result = await updateHealthCardUrl(uploadedUrl);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Health card updated successfully');
      }
    } catch (error) {
      toast.error('An error occurred while uploading your health card');
      console.error('Health card upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleViewHealthCard = () => {
    if (profile.health_card_url) {
      window.open(profile.health_card_url, '_blank');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Health Card</CardTitle>
        <CardDescription>
          Upload an image or PDF of your health card for company records
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Health Card Status */}
        <div className="mb-6 p-4 border rounded-lg bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DocumentIcon className="h-8 w-8 text-primary/70" />
            <div>
              <p className="font-medium">
                {fileName ? 'Health Card Uploaded' : 'No Health Card Uploaded'}
              </p>
              {fileName && (
                <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                  {fileName}
                </p>
              )}
            </div>
          </div>
          
          {profile.health_card_url && (
            <Button variant="outline" size="sm" onClick={handleViewHealthCard}>
              View
            </Button>
          )}
        </div>

        {/* Upload Button */}
        <Button 
          onClick={handleButtonClick} 
          disabled={isUploading}
          className="flex items-center gap-2 w-full"
        >
          <DocumentPlusIcon className="h-5 w-5" />
          {isUploading ? 'Uploading...' : (fileName ? 'Replace Health Card' : 'Upload Health Card')}
        </Button>

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*,application/pdf"
          className="hidden"
        />
      </CardContent>
    </Card>
  );
}
