'use server'

import { createClient } from '@/lib/supabase/server'
import { Database } from '@/lib/supabase/database.types'
import { revalidatePath } from 'next/cache'
import type { SupabaseClient } from '@supabase/supabase-js' // Import the type

// Define return type for actions
type QrActionResult = {
  success: boolean;
  message?: string;
};

// Helper to check admin status
// Expects the *resolved* Supabase client
async function checkAdmin(supabase: SupabaseClient<Database>): Promise<{ isAdmin: boolean; userId: string | null }> {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { isAdmin: false, userId: null };
  }
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return { isAdmin: !profileError && profile?.role === 'admin', userId: user.id };
}

// Action to save a new QR code configuration
export async function saveQrConfig(locationIdentifier: string, qrValue: string): Promise<QrActionResult> {
  const supabase = await createClient() // Await here to resolve the client
  const { isAdmin, userId } = await checkAdmin(supabase); // Pass the resolved client

  if (!isAdmin) {
    return { success: false, message: "Unauthorized action." };
  }
  if (!locationIdentifier?.trim() || !qrValue?.trim()) {
      return { success: false, message: "Location identifier and QR value cannot be empty." };
  }

  const { error } = await supabase // Use the awaited client
    .from('qr_configs')
    .insert({
      location_identifier: locationIdentifier.trim(),
      qr_value: qrValue.trim(),
      created_by: userId, // Store who created it
    });

  if (error) {
    console.error("Error saving QR config:", error);
    if (error.code === '23505') { 
         return { success: false, message: `Failed to save: Location identifier '${locationIdentifier.trim()}' already exists.` };
    }
    return { success: false, message: `Failed to save QR config: ${error.message}` };
  }

  revalidatePath('/admin/qr-codes'); 
  return { success: true, message: "QR Code configuration saved successfully." };
}

// Action to delete a QR code configuration
export async function deleteQrConfig(id: number): Promise<QrActionResult> {
  const supabase = await createClient() // Await here to resolve the client
  const { isAdmin } = await checkAdmin(supabase); // Pass the resolved client

  if (!isAdmin) {
    return { success: false, message: "Unauthorized action." };
  }

  if (typeof id !== 'number' || id <= 0) {
      return { success: false, message: "Invalid ID for deletion." };
  }

  const { error } = await supabase // Use the awaited client
    .from('qr_configs')
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Error deleting QR config:", error);
    return { success: false, message: `Failed to delete QR config: ${error.message}` };
  }

  revalidatePath('/admin/qr-codes'); 
  return { success: true, message: "QR Code configuration deleted successfully." };
} 