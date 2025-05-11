-- Create storage buckets for profile pictures and health cards
-- Run this in the Supabase SQL editor

-- Create the profile-pictures bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('profile-pictures', 'profile-pictures', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Create the health-cards bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('health-cards', 'health-cards', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for the profile-pictures bucket
-- Allow users to read any profile picture
CREATE POLICY "Public profile pictures are viewable by everyone" ON storage.objects
FOR SELECT
USING (bucket_id = 'profile-pictures');

-- Allow authenticated users to upload their own profile pictures
CREATE POLICY "Users can upload their own profile pictures" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-pictures' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update/delete their own profile pictures
CREATE POLICY "Users can update/delete their own profile pictures" ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-pictures' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Create RLS policies for the health-cards bucket
-- Allow users to read their own health cards
CREATE POLICY "Users can view their own health cards" ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'health-cards' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow managers to view health cards of users in their department
CREATE POLICY "Managers can view health cards of users in their department" ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'health-cards' AND
  EXISTS (
    SELECT 1 FROM profiles p1, profiles p2
    WHERE p1.id = auth.uid() AND
          p1.role = 'manager' AND
          p1.department_id = p2.department_id AND
          p2.id::text = (storage.foldername(name))[1]
  )
);

-- Allow admins to view all health cards
CREATE POLICY "Admins can view all health cards" ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'health-cards' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND
          profiles.role = 'admin'
  )
);

-- Allow authenticated users to upload their own health cards
CREATE POLICY "Users can upload their own health cards" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'health-cards' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to update/delete their own health cards
CREATE POLICY "Users can update/delete their own health cards" ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'health-cards' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
