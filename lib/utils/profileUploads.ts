import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Upload a profile picture to Supabase storage
 * @param supabase Supabase client
 * @param userId User ID
 * @param file File to upload
 * @returns URL of the uploaded file
 */
export async function uploadProfilePicture(
  supabase: SupabaseClient,
  userId: string,
  file: File
): Promise<string | null> {
  try {
    // Create a unique file path
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `${userId}/profile-pictures/${fileName}`;

    // Upload the file
    const { error: uploadError } = await supabase.storage
      .from('profile-pictures')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading profile picture:', uploadError);
      return null;
    }

    // Get the public URL
    const { data } = supabase.storage
      .from('profile-pictures')
      .getPublicUrl(filePath);

    return data.publicUrl;
  } catch (error) {
    console.error('Error in uploadProfilePicture:', error);
    return null;
  }
}

/**
 * Upload a health card image to Supabase storage
 * @param supabase Supabase client
 * @param userId User ID
 * @param file File to upload
 * @returns URL of the uploaded file
 */
export async function uploadHealthCard(
  supabase: SupabaseClient,
  userId: string,
  file: File
): Promise<string | null> {
  try {
    // Create a unique file path
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `${userId}/health-cards/${fileName}`;

    // Upload the file
    const { error: uploadError } = await supabase.storage
      .from('health-cards')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading health card:', uploadError);
      return null;
    }

    // Get the public URL
    const { data } = supabase.storage
      .from('health-cards')
      .getPublicUrl(filePath);

    return data.publicUrl;
  } catch (error) {
    console.error('Error in uploadHealthCard:', error);
    return null;
  }
}
