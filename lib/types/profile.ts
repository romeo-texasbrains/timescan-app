import { Database } from "@/lib/supabase/database.types";

// Define the Profile type based on the database type
export type Profile = Database['public']['Tables']['profiles']['Row'] & {
  role?: string; // Add role property which comes from user_roles table
};

// Define a type for the profile form data
export type ProfileFormData = {
  full_name: string;
  phone_number: string;
  address: string;
  date_of_birth: string;
  emergency_contact_name: string;
  emergency_contact_relationship: string;
  emergency_contact_phone: string;
};

// Define a type for the profile picture upload
export type ProfilePictureUpload = {
  file: File;
  url: string;
};

// Define a type for the health card upload
export type HealthCardUpload = {
  file: File;
  url: string;
};

// Function to get initials from a name
export function getInitials(name: string | null): string {
  if (!name) return '??';

  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Function to format a date for display
export function formatDate(date: string | null): string {
  if (!date) return 'Not set';

  return new Date(date).toLocaleDateString();
}

// Function to format a date for input fields
export function formatDateForInput(date: string | null): string {
  if (!date) return '';

  const d = new Date(date);
  return d.toISOString().split('T')[0];
}
