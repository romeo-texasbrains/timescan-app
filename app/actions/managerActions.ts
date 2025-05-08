'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

// Schema for updating an attendance log
const UpdateAttendanceLogSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().min(1, { message: "Timestamp is required" }),
  event_type: z.enum(['signin', 'signout', 'break_start', 'break_end'], { 
    message: "Invalid event type" 
  }),
  notes: z.string().optional(),
});

// Schema for creating a new attendance log
const CreateAttendanceLogSchema = z.object({
  user_id: z.string().uuid({ message: "Valid employee ID is required" }),
  timestamp: z.string().min(1, { message: "Timestamp is required" }),
  event_type: z.enum(['signin', 'signout', 'break_start', 'break_end'], { 
    message: "Invalid event type" 
  }),
  notes: z.string().min(1, { message: "Adjustment notes are required" }),
});

// Helper function to check if user is a manager or admin
async function checkManagerPermission() {
  const supabase = await createClient();
  
  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return { isAuthorized: false, message: "Authentication required" };
  }
  
  // Check user role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  
  if (profileError || (profile?.role !== 'manager' && profile?.role !== 'admin')) {
    return { isAuthorized: false, message: "Requires manager or admin permission" };
  }
  
  return { isAuthorized: true, userId: user.id };
}

// Action to update an attendance log
export async function updateAttendanceLog(formData: FormData) {
  // Check permissions
  const { isAuthorized, message } = await checkManagerPermission();
  if (!isAuthorized) {
    redirect(`/login?message=${encodeURIComponent(message || "Unauthorized")}`);
  }
  
  // Parse and validate form data
  const rawData = {
    id: formData.get('id') as string,
    timestamp: formData.get('timestamp') as string,
    event_type: formData.get('event_type') as string,
    notes: formData.get('notes') as string,
  };
  
  // Validate data
  const validationResult = UpdateAttendanceLogSchema.safeParse(rawData);
  if (!validationResult.success) {
    console.error("Validation error:", validationResult.error.errors);
    // In a real app, you'd want to return these errors to the form
    redirect('/mgmt/adjustments?error=Invalid form data');
  }
  
  const data = validationResult.data;
  
  // Format timestamp to ISO string
  const timestamp = new Date(data.timestamp).toISOString();
  
  // Update the log
  const supabase = await createClient();
  const { error } = await supabase
    .from('attendance_logs')
    .update({
      timestamp,
      event_type: data.event_type,
      // In a production app, you might want to store the notes in a separate audit table
    })
    .eq('id', data.id);
  
  if (error) {
    console.error("Error updating log:", error);
    redirect('/mgmt/adjustments?error=Failed to update log');
  }
  
  // Revalidate the adjustments page to show updated data
  revalidatePath('/mgmt/adjustments');
  
  // Redirect back to the adjustments page
  redirect('/mgmt/adjustments?success=Log updated successfully');
}

// Action to create a new attendance log
export async function createAttendanceLog(formData: FormData) {
  // Check permissions
  const { isAuthorized, message, userId } = await checkManagerPermission();
  if (!isAuthorized) {
    redirect(`/login?message=${encodeURIComponent(message || "Unauthorized")}`);
  }
  
  // Parse and validate form data
  const rawData = {
    user_id: formData.get('user_id') as string,
    timestamp: formData.get('timestamp') as string,
    event_type: formData.get('event_type') as string,
    notes: formData.get('notes') as string,
  };
  
  // Validate data
  const validationResult = CreateAttendanceLogSchema.safeParse(rawData);
  if (!validationResult.success) {
    console.error("Validation error:", validationResult.error.errors);
    // In a real app, you'd want to return these errors to the form
    redirect('/mgmt/adjustments/new?error=Invalid form data');
  }
  
  const data = validationResult.data;
  
  // Format timestamp to ISO string
  const timestamp = new Date(data.timestamp).toISOString();
  
  // Create the log
  const supabase = await createClient();
  const { error } = await supabase
    .from('attendance_logs')
    .insert({
      user_id: data.user_id,
      timestamp,
      event_type: data.event_type,
      // In a production app, you might want to store the notes and created_by in a separate audit table
    });
  
  if (error) {
    console.error("Error creating log:", error);
    redirect('/mgmt/adjustments/new?error=Failed to create log');
  }
  
  // Revalidate the adjustments page to show updated data
  revalidatePath('/mgmt/adjustments');
  
  // Redirect back to the adjustments page
  redirect('/mgmt/adjustments?success=Log created successfully');
}
