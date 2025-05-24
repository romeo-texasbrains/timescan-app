import { createClient } from '@/lib/supabase/server';
import { format } from 'date-fns';

/**
 * Get users with optional filtering
 * @param filters Optional filters for the query
 * @returns Array of user profiles
 */
export async function getUsers(filters?: {
  departmentIds?: string[],
  userId?: string,
  excludeUserId?: string
}) {
  try {
    const supabase = await createClient();
    let query = supabase.from('profiles').select('id, full_name, email, role, department_id');

    // Apply filters if provided
    if (filters) {
      if (filters.userId) {
        query = query.eq('id', filters.userId);
      }

      if (filters.excludeUserId) {
        query = query.neq('id', filters.excludeUserId);
      }

      if (filters.departmentIds && filters.departmentIds.length > 0) {
        query = query.in('department_id', filters.departmentIds);
      }
    }

    // Order by name for consistent results
    query = query.order('full_name');

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching users:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getUsers:', error);
    throw error;
  }
}

/**
 * Get departments with optional filtering
 * @param filters Optional filters for the query
 * @returns Array of departments
 */
export async function getDepartments(filters?: {
  managerId?: string,
  departmentId?: string
}) {
  try {
    const supabase = await createClient();
    let query = supabase.from('departments').select('*');

    // Apply filters if provided
    if (filters) {
      if (filters.departmentId) {
        query = query.eq('id', filters.departmentId);
      }

      // If we need to filter by manager ID in the future
      // This assumes there's a manager_id column in the departments table
      if (filters.managerId) {
        query = query.eq('manager_id', filters.managerId);
      }
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching departments:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getDepartments:', error);
    throw error;
  }
}

/**
 * Get attendance logs with optional filtering
 * @param filters Optional filters for the query
 * @returns Array of attendance logs
 */
export async function getAttendanceLogs(filters?: {
  date?: Date,
  userId?: string,
  userIds?: string[],
  dateRange?: { start: Date, end: Date },
  limit?: number,
  orderDirection?: 'asc' | 'desc'
}) {
  try {
    const supabase = await createClient();
    let query = supabase.from('attendance_logs').select('*');

    // Apply filters if provided
    if (filters) {
      // Filter by single user ID
      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }

      // Filter by multiple user IDs
      if (filters.userIds && filters.userIds.length > 0) {
        query = query.in('user_id', filters.userIds);
      }

      // Filter by specific date
      if (filters.date) {
        const dateStr = format(filters.date, 'yyyy-MM-dd');
        query = query
          .gte('timestamp', `${dateStr}T00:00:00`)
          .lte('timestamp', `${dateStr}T23:59:59`);
      }

      // Filter by date range
      if (filters.dateRange) {
        const startStr = format(filters.dateRange.start, 'yyyy-MM-dd');
        const endStr = format(filters.dateRange.end, 'yyyy-MM-dd');
        query = query
          .gte('timestamp', `${startStr}T00:00:00`)
          .lte('timestamp', `${endStr}T23:59:59`);
      }

      // Apply ordering
      query = query.order('timestamp', {
        ascending: filters.orderDirection === 'asc'
      });

      // Apply limit if provided
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
    } else {
      // Default ordering if no filters provided
      query = query.order('timestamp', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching attendance logs:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getAttendanceLogs:', error);
    throw error;
  }
}

/**
 * Get the count of attendance logs for a specific date
 * @param date The date to count logs for
 * @returns The count of logs for the specified date
 */
export async function getAttendanceLogsCount(date: Date) {
  try {
    const supabase = await createClient();
    const dateStr = format(date, 'yyyy-MM-dd');

    const { count, error } = await supabase
      .from('attendance_logs')
      .select('*', { count: 'exact', head: true })
      .gte('timestamp', `${dateStr}T00:00:00`)
      .lte('timestamp', `${dateStr}T23:59:59`);

    if (error) {
      console.error('Error counting attendance logs:', error);
      throw error;
    }

    return count || 0;
  } catch (error) {
    console.error('Error in getAttendanceLogsCount:', error);
    throw error;
  }
}

/**
 * Get adherence records for a specific date
 * @param date The date to get adherence records for
 * @param userId Optional user ID to filter by
 * @returns Array of adherence records
 */
export async function getAdherenceRecords(date: Date, userId?: string) {
  try {
    const supabase = await createClient();
    const dateStr = format(date, 'yyyy-MM-dd');

    let query = supabase
      .from('attendance_adherence')
      .select('*')
      .eq('date', dateStr);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching adherence records:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getAdherenceRecords:', error);
    throw error;
  }
}

/**
 * Get departments assigned to a manager
 * @param managerId The manager's user ID
 * @returns Array of departments the manager is responsible for
 */
export async function getManagerAssignedDepartments(managerId: string) {
  try {
    const supabase = await createClient();

    // First get the manager's department
    const { data: managerProfile, error: profileError } = await supabase
      .from('profiles')
      .select('department_id')
      .eq('id', managerId)
      .single();

    if (profileError) {
      console.error('Error fetching manager profile:', profileError);
      throw profileError;
    }

    if (!managerProfile?.department_id) {
      return [];
    }

    // Get the department details
    const { data: departments, error: deptError } = await supabase
      .from('departments')
      .select('*')
      .eq('id', managerProfile.department_id);

    if (deptError) {
      console.error('Error fetching manager departments:', deptError);
      throw deptError;
    }

    return departments || [];
  } catch (error) {
    console.error('Error in getManagerAssignedDepartments:', error);
    throw error;
  }
}

/**
 * Get the application settings
 * @returns The application settings
 */
export async function getAppSettings() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('app_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) {
      console.error('Error fetching app settings:', error);
      throw error;
    }

    return data || { timezone: 'UTC' };
  } catch (error) {
    console.error('Error in getAppSettings:', error);
    throw error;
  }
}
