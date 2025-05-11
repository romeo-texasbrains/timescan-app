'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ProfileFormData } from '@/lib/types/profile';

/**
 * Update a user's profile information
 */
export async function updateProfile(formData: FormData) {
  const supabase = await createClient();

  // Get the current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: 'Authentication error. Please log in again.' };
  }

  // Extract form data
  const profileData: Partial<ProfileFormData> = {
    full_name: formData.get('full_name') as string,
    phone_number: formData.get('phone_number') as string,
    address: formData.get('address') as string,
    date_of_birth: formData.get('date_of_birth') as string,
    emergency_contact_name: formData.get('emergency_contact_name') as string,
    emergency_contact_relationship: formData.get('emergency_contact_relationship') as string,
    emergency_contact_phone: formData.get('emergency_contact_phone') as string,
  };

  // Update the profile
  const { error: updateError } = await supabase
    .from('profiles')
    .update(profileData)
    .eq('id', user.id);

  if (updateError) {
    return { error: `Error updating profile: ${updateError.message}` };
  }

  // Revalidate the profile page
  revalidatePath('/profile');
  
  return { success: true };
}

/**
 * Update a user's profile picture URL
 */
export async function updateProfilePictureUrl(profilePictureUrl: string) {
  const supabase = await createClient();

  // Get the current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: 'Authentication error. Please log in again.' };
  }

  // Update the profile
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ profile_picture_url: profilePictureUrl })
    .eq('id', user.id);

  if (updateError) {
    return { error: `Error updating profile picture: ${updateError.message}` };
  }

  // Revalidate the profile page
  revalidatePath('/profile');
  
  return { success: true };
}

/**
 * Update a user's health card URL
 */
export async function updateHealthCardUrl(healthCardUrl: string) {
  const supabase = await createClient();

  // Get the current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: 'Authentication error. Please log in again.' };
  }

  // Update the profile
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ health_card_url: healthCardUrl })
    .eq('id', user.id);

  if (updateError) {
    return { error: `Error updating health card: ${updateError.message}` };
  }

  // Revalidate the profile page
  revalidatePath('/profile');
  
  return { success: true };
}
