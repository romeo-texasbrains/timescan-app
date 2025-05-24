'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { format, parseISO } from 'date-fns';
import { z } from 'zod';

// Input validation schema for recalculating adherence
const RecalculateAdherenceSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Start date must be in YYYY-MM-DD format' }),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'End date must be in YYYY-MM-DD format' }),
  userId: z.string().uuid().optional(),
});

// Type for action result
type ActionResult = {
  success: boolean;
  message: string;
  data?: any;
};

/**
 * Server action to recalculate adherence status for a date range
 * 
 * @param formData Form data containing startDate, endDate, and optional userId
 * @returns ActionResult with success status and message
 */
export async function recalculateAdherence(formData: FormData): Promise<ActionResult> {
  try {
    // Extract and validate form data
    const rawData = {
      startDate: formData.get('startDate') as string,
      endDate: formData.get('endDate') as string,
      userId: formData.get('userId') as string || undefined,
    };

    // Validate input
    const validationResult = RecalculateAdherenceSchema.safeParse(rawData);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(err => `${err.path}: ${err.message}`).join(', ');
      return {
        success: false,
        message: `Invalid input: ${errorMessage}`,
      };
    }

    const { startDate, endDate, userId } = validationResult.data;

    // Create Supabase client
    const supabase = await createClient();

    // Check if user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return {
        success: false,
        message: 'Authentication required',
      };
    }

    // Get user role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      return {
        success: false,
        message: 'Only administrators can recalculate adherence',
      };
    }

    // Call the appropriate RPC function based on whether userId is provided
    let result;
    if (userId) {
      // Recalculate for specific user
      const { data, error } = await supabase.rpc('recalculate_adherence_for_user', {
        p_user_id: userId,
        p_start_date: startDate,
        p_end_date: endDate,
      });

      if (error) {
        console.error('Error recalculating adherence for user:', error);
        return {
          success: false,
          message: `Failed to recalculate adherence: ${error.message}`,
        };
      }

      result = data;
    } else {
      // Recalculate for all users
      const { data, error } = await supabase.rpc('recalculate_adherence', {
        p_start_date: startDate,
        p_end_date: endDate,
      });

      if (error) {
        console.error('Error recalculating adherence:', error);
        return {
          success: false,
          message: `Failed to recalculate adherence: ${error.message}`,
        };
      }

      result = data;
    }

    // Revalidate relevant paths
    revalidatePath('/admin/adherence');
    revalidatePath('/admin/dashboard');
    revalidatePath('/mgmt');
    revalidatePath('/');

    return {
      success: true,
      message: 'Adherence recalculation completed successfully',
      data: result,
    };
  } catch (error) {
    console.error('Error in recalculateAdherence action:', error);
    return {
      success: false,
      message: 'An unexpected error occurred',
    };
  }
}

/**
 * Server action to mark a user as absent for a specific date
 * 
 * @param formData Form data containing userId and date
 * @returns ActionResult with success status and message
 */
export async function markUserAbsent(formData: FormData): Promise<ActionResult> {
  try {
    // Extract form data
    const userId = formData.get('userId') as string;
    const date = formData.get('date') as string;
    const markAbsent = formData.get('markAbsent') === 'true';

    // Validate input
    if (!userId || !date) {
      return {
        success: false,
        message: 'User ID and date are required',
      };
    }

    // Create Supabase client
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return {
        success: false,
        message: 'Authentication required',
      };
    }

    // Get user role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, department_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return {
        success: false,
        message: 'Failed to get user profile',
      };
    }

    // Check if user is admin or manager
    if (profile.role !== 'admin' && profile.role !== 'manager') {
      return {
        success: false,
        message: 'Only administrators and managers can mark users as absent',
      };
    }

    // If manager, check if they manage the user
    if (profile.role === 'manager') {
      const { data: targetUser, error: targetUserError } = await supabase
        .from('profiles')
        .select('department_id')
        .eq('id', userId)
        .single();

      if (targetUserError || targetUser.department_id !== profile.department_id) {
        return {
          success: false,
          message: 'You can only mark users in your department as absent',
        };
      }
    }

    // Update or insert the adherence record
    const { error } = await supabase
      .from('attendance_adherence')
      .upsert({
        user_id: userId,
        date,
        status: markAbsent ? 'absent' : 'late',
        marked_by: user.id,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error updating adherence status:', error);
      return {
        success: false,
        message: 'Error updating adherence status',
      };
    }

    // Revalidate relevant paths
    revalidatePath('/admin/adherence');
    revalidatePath('/admin/dashboard');
    revalidatePath('/mgmt');

    return {
      success: true,
      message: markAbsent ? 'Employee marked as absent' : 'Employee marked as late',
    };
  } catch (error) {
    console.error('Error in markUserAbsent action:', error);
    return {
      success: false,
      message: 'An unexpected error occurred',
    };
  }
}
