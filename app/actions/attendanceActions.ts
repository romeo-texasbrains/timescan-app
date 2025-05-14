'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

type AttendanceLogUpdate = {
  id: string;
  timestamp: string | null;
  event_type: string;
};

type UpdateAttendanceData = {
  employeeId: string;
  date: string;
  action: string;
  logs: AttendanceLogUpdate[];
};

type MarkAbsentData = {
  userId: string;
  date: string;
  markAbsent: boolean;
};

export async function markEmployeeAbsent(data: MarkAbsentData) {
  try {
    const supabase = await createClient();

    // Check authorization
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, message: 'Unauthorized' };
    }

    // Verify user is admin or manager
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, department_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return { success: false, message: 'Error fetching user profile' };
    }

    if (profile.role !== 'admin' && profile.role !== 'manager') {
      return { success: false, message: 'Unauthorized access' };
    }

    // For managers, verify they can edit this employee (same department)
    if (profile.role === 'manager') {
      // Check if employee is in the manager's department
      const { data: employeeProfile, error: employeeError } = await supabase
        .from('profiles')
        .select('department_id')
        .eq('id', data.userId)
        .single();

      if (employeeError) {
        console.error('Error fetching employee profile:', employeeError);
        return { success: false, message: 'Error fetching employee profile' };
      }

      if (employeeProfile.department_id !== profile.department_id) {
        return { success: false, message: 'You can only mark employees in your department as absent' };
      }
    }

    // Check if the user is eligible to be marked absent
    if (data.markAbsent) {
      const { data: eligibility, error: eligibilityError } = await supabase
        .rpc('check_absent_eligibility', {
          p_user_id: data.userId,
          p_date: data.date
        });

      if (eligibilityError) {
        console.error('Error checking absent eligibility:', eligibilityError);
        return { success: false, message: 'Error checking absent eligibility' };
      }

      if (!eligibility) {
        return { success: false, message: 'Employee is not eligible to be marked absent' };
      }
    }

    // Update or insert the adherence record
    const { error } = await supabase
      .from('attendance_adherence')
      .upsert({
        user_id: data.userId,
        date: data.date,
        status: data.markAbsent ? 'absent' : 'late', // If not marking absent, revert to late
        marked_by: user.id,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error updating adherence status:', error);
      return { success: false, message: 'Error updating adherence status' };
    }

    // Revalidate relevant paths
    revalidatePath('/admin/dashboard');
    revalidatePath('/mgmt');

    return {
      success: true,
      message: data.markAbsent ? 'Employee marked as absent' : 'Employee marked as late'
    };
  } catch (error) {
    console.error('Error in markEmployeeAbsent:', error);
    return { success: false, message: 'An unexpected error occurred' };
  }
}

export async function updateAttendanceLogs(data: UpdateAttendanceData) {
  try {
    const supabase = await createClient();

    // Check authorization
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, message: 'Unauthorized' };
    }

    // Verify user is admin or manager
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, department_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return { success: false, message: 'Error fetching user profile' };
    }

    if (profile.role !== 'admin' && profile.role !== 'manager') {
      return { success: false, message: 'Unauthorized access' };
    }

    // For managers, verify they can edit this employee (same department and not themselves)
    if (profile.role === 'manager') {
      // Managers can't edit their own records
      if (data.employeeId === user.id) {
        return { success: false, message: 'You cannot edit your own attendance records' };
      }

      // Check if employee is in the manager's department
      const { data: employeeProfile, error: employeeError } = await supabase
        .from('profiles')
        .select('department_id')
        .eq('id', data.employeeId)
        .single();

      if (employeeError) {
        console.error('Error fetching employee profile:', employeeError);
        return { success: false, message: 'Error fetching employee profile' };
      }

      if (employeeProfile.department_id !== profile.department_id) {
        return { success: false, message: 'You can only edit employees in your department' };
      }
    }

    // Handle delete action
    if (data.action === 'delete') {
      console.log('Deleting attendance logs for employee:', data.employeeId, 'on date:', data.date);

      // Get the start and end of the day in UTC
      const startOfDay = `${data.date}T00:00:00.000Z`;
      const endOfDay = `${data.date}T23:59:59.999Z`;

      // First, fetch the logs to be deleted (for logging purposes)
      const { data: logsToDelete, error: fetchError } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('user_id', data.employeeId)
        .gte('timestamp', startOfDay)
        .lte('timestamp', endOfDay);

      if (fetchError) {
        console.error('Error fetching logs to delete:', fetchError);
      } else {
        console.log('Logs to be deleted:', logsToDelete);
      }

      // Delete all logs for this employee on this day
      const { error: deleteError } = await supabase
        .from('attendance_logs')
        .delete()
        .eq('user_id', data.employeeId)
        .gte('timestamp', startOfDay)
        .lte('timestamp', endOfDay);

      if (deleteError) {
        console.error('Error deleting attendance logs:', deleteError);
        return { success: false, message: 'Error deleting attendance logs' };
      }

      // Revalidate the reports pages
      revalidatePath('/admin/reports');
      revalidatePath('/mgmt/reports');
      revalidatePath('/history/reports');

      return { success: true, message: 'Attendance records deleted successfully' };
    }

    // Handle update action
    if (data.action === 'update') {
      console.log('Updating attendance logs for employee:', data.employeeId, 'on date:', data.date);
      console.log('Logs to update:', data.logs);

      // First, check if we have valid signin and signout times
      const signinLog = data.logs.find(log => log.event_type === 'signin' && log.timestamp);
      const signoutLog = data.logs.find(log => log.event_type === 'signout' && log.timestamp);

      if (!signinLog || !signoutLog) {
        return { success: false, message: 'Both sign in and sign out times are required' };
      }

      // Verify that the signin and signout times make sense
      const signinTime = new Date(signinLog.timestamp!).getTime();
      const signoutTime = new Date(signoutLog.timestamp!).getTime();

      // For overnight shifts, signout time will be greater than signin time
      // For same-day shifts, signout time should also be greater than signin time
      if (signoutTime <= signinTime) {
        console.error('Invalid time range: signout time is before or equal to signin time');
        return { success: false, message: 'Sign out time must be after sign in time' };
      }

      // For simplicity and to avoid issues with partial updates,
      // we'll always delete existing logs and create new ones
      // This ensures we have a clean slate and prevents duplicate or orphaned logs

      // First, identify the date range we need to clear
      // We need to handle both the anchor date and potentially the next day for overnight shifts
      const anchorDate = new Date(data.date);
      console.log(`Anchor date for attendance update: ${anchorDate.toISOString()}`);

      // We already have signinLog and signoutLog from above, so we'll reuse them
      // to check if this is an overnight shift
      let isOvernightShift = false;
      if (signinLog && signoutLog) {
        const signinDate = new Date(signinLog.timestamp!);
        const signoutDate = new Date(signoutLog.timestamp!);
        isOvernightShift = signinDate.getUTCDate() !== signoutDate.getUTCDate();
        console.log(`Detected ${isOvernightShift ? 'overnight' : 'same-day'} shift`);
      }

      // Determine the date range to clear
      const startOfAnchorDay = new Date(anchorDate);
      startOfAnchorDay.setUTCHours(0, 0, 0, 0);

      // For the end date, use the end of the next day if it's an overnight shift
      // otherwise use the end of the anchor day
      const endDate = new Date(anchorDate);
      if (isOvernightShift) {
        endDate.setUTCDate(endDate.getUTCDate() + 1);
      }
      endDate.setUTCHours(23, 59, 59, 999);

      console.log(`Clearing logs from ${startOfAnchorDay.toISOString()} to ${endDate.toISOString()}`);

      // Delete existing logs in the date range
      const { error: deleteError } = await supabase
        .from('attendance_logs')
        .delete()
        .eq('user_id', data.employeeId)
        .gte('timestamp', startOfAnchorDay.toISOString())
        .lte('timestamp', endDate.toISOString());

      if (deleteError) {
        console.error('Error deleting existing logs:', deleteError);
        return { success: false, message: 'Error preparing to update logs' };
      }

      console.log('Successfully deleted existing logs');

      // Insert all new logs
      for (const log of data.logs) {
        if (!log.timestamp) continue; // Skip logs with no timestamp

        console.log(`Inserting ${log.event_type} log with timestamp ${log.timestamp}`);

        // Create new log
        const { data: insertData, error: insertError } = await supabase
          .from('attendance_logs')
          .insert({
            user_id: data.employeeId,
            timestamp: log.timestamp,
            event_type: log.event_type
          })
          .select();

        if (insertError) {
          console.error(`Error creating ${log.event_type} log:`, insertError);
          return { success: false, message: `Error creating ${log.event_type} log` };
        }

        console.log(`Successfully created new ${log.event_type} log:`, insertData);
      }

      // Revalidate the reports pages
      revalidatePath('/admin/reports');
      revalidatePath('/mgmt/reports');
      revalidatePath('/history/reports');

      return { success: true, message: 'Attendance records updated successfully' };
    }

    return { success: false, message: 'Invalid action' };
  } catch (error) {
    console.error('Error in updateAttendanceLogs:', error);
    return { success: false, message: 'An unexpected error occurred' };
  }
}
