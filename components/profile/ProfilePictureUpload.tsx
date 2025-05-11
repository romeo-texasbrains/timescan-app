'use client';

import { useState, useRef } from 'react';
import { Profile } from '@/lib/types/profile';
import { uploadProfilePicture } from '@/lib/utils/profileUploads';
import { updateProfilePictureUrl } from '@/app/actions/profileActions';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { getInitials } from '@/lib/types/profile';
import { UserCircleIcon, CameraIcon } from '@heroicons/react/24/outline';

interface ProfilePictureUploadProps {
  profile: Profile;
}

export default function ProfilePictureUpload({ profile }: ProfilePictureUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(profile.profile_picture_url);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size should be less than 5MB');
      return;
    }

    // Create a preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    // Upload the file
    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Authentication error. Please log in again.');
        return;
      }

      const uploadedUrl = await uploadProfilePicture(supabase, user.id, file);
      if (!uploadedUrl) {
        toast.error('Error uploading profile picture');
        return;
      }

      // Update the profile with the new URL
      const result = await updateProfilePictureUrl(uploadedUrl);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Profile picture updated successfully');
      }
    } catch (error) {
      toast.error('An error occurred while uploading your profile picture');
      console.error('Profile picture upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Picture</CardTitle>
        <CardDescription>
          Upload a profile picture to personalize your account
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        {/* Profile Picture Preview */}
        <div className="mb-6">
          <Avatar className="h-32 w-32 border-2 border-primary/20">
            {previewUrl ? (
              <AvatarImage src={previewUrl} alt={profile.full_name || 'Profile'} />
            ) : (
              <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                {profile.full_name ? getInitials(profile.full_name) : <UserCircleIcon className="h-16 w-16" />}
              </AvatarFallback>
            )}
          </Avatar>
        </div>

        {/* Upload Button */}
        <Button 
          onClick={handleButtonClick} 
          disabled={isUploading}
          className="flex items-center gap-2"
        >
          <CameraIcon className="h-5 w-5" />
          {isUploading ? 'Uploading...' : 'Upload Picture'}
        </Button>

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          className="hidden"
        />
      </CardContent>
    </Card>
  );
}
