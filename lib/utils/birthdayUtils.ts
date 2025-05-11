import { SupabaseClient } from '@supabase/supabase-js';
import { Profile } from '@/lib/types/profile';

/**
 * Check if today is a user's birthday
 * @param dateOfBirth Date of birth string in ISO format
 * @returns Boolean indicating if today is the user's birthday
 */
export function isBirthdayToday(dateOfBirth: string | null): boolean {
  if (!dateOfBirth) return false;
  
  const today = new Date();
  const dob = new Date(dateOfBirth);
  
  return today.getMonth() === dob.getMonth() && 
         today.getDate() === dob.getDate();
}

/**
 * Get all users whose birthday is today
 * @param supabase Supabase client
 * @returns Array of profiles with birthdays today
 */
export async function getTodaysBirthdays(
  supabase: SupabaseClient
): Promise<Profile[]> {
  try {
    // Get the current date
    const today = new Date();
    const month = today.getMonth() + 1; // JavaScript months are 0-indexed
    const day = today.getDate();
    
    // Query for users with birthdays today
    // We need to use EXTRACT to get the month and day from the date_of_birth field
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .not('date_of_birth', 'is', null)
      .filter('EXTRACT(MONTH FROM date_of_birth)', 'eq', month)
      .filter('EXTRACT(DAY FROM date_of_birth)', 'eq', day);
    
    if (error) {
      console.error('Error fetching birthdays:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Error in getTodaysBirthdays:', error);
    return [];
  }
}

/**
 * Format a birthday message
 * @param profile User profile
 * @returns Formatted birthday message
 */
export function formatBirthdayMessage(profile: Profile): string {
  return `Today is ${profile.full_name}'s birthday! 🎉`;
}

/**
 * Calculate age from date of birth
 * @param dateOfBirth Date of birth string in ISO format
 * @returns Age in years
 */
export function calculateAge(dateOfBirth: string | null): number | null {
  if (!dateOfBirth) return null;
  
  const today = new Date();
  const dob = new Date(dateOfBirth);
  
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  
  // If birthday hasn't occurred yet this year, subtract 1
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  
  return age;
}
