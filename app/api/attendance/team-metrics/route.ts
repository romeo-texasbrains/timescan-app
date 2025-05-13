import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { formatInTimeZone } from 'date-fns-tz';
import { startOfDay, parseISO, format } from 'date-fns';
import { capShiftDuration, MAX_SHIFT_DURATION_SECONDS } from '@/lib/shift-utils';
import { Database } from '@/lib/supabase/database.types';
import { determineUserStatus, getLastActivity } from '@/lib/utils/statusDetermination';
import { parseRequestUrl } from '@/lib/utils/api-utils';

type AttendanceLog = Database['public']['Tables']['attendance_logs']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface TimePeriod {
  start: Date;
  end: Date;
}

interface EmployeeMetrics {
  userId: string;
  fullName: string;
  email: string;
  role: string;
  departmentId: string | null;
  departmentName: string | null;
  workTime: number; // in seconds
  breakTime: number; // in seconds
  overtimeSeconds: number;
  isActive: boolean;
  isOnBreak: boolean;
  lastActivity: {
    type: 'signin' | 'signout' | 'break_start' | 'break_end';
    timestamp: string;
  } | null;
}

/**
 * Calculate attendance metrics for a single user
 */
function calculateUserAttendanceMetrics(
  logs: AttendanceLog[],
  timezone: string,
  profile: Profile
): EmployeeMetrics {
  // Sort logs chronologically
  const sortedLogs = [...logs].sort(
    (a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
  );

  // Initialize tracking variables
  const activePeriods: TimePeriod[] = [];
  const breakPeriods: TimePeriod[] = [];

  let isActive = false;
  let isOnBreak = false;
  let activeStart: Date | null = null;
  let breakStart: Date | null = null;

  // Get last activity using our utility function
  const lastActivity = getLastActivity(logs);

  // Determine current status using our utility function
  const currentStatus = determineUserStatus(logs);
  isActive = currentStatus === 'signed_in';
  isOnBreak = currentStatus === 'on_break';

  // Current time in the specified timezone
  const now = new Date();
  const nowInTimezone = new Date(formatInTimeZone(now, timezone, 'yyyy-MM-dd HH:mm:ss'));

  // Process logs to identify active and break periods
  for (const log of sortedLogs) {
    if (!log.timestamp) continue;

    const timestamp = new Date(log.timestamp);
    const timestampInTimezone = new Date(formatInTimeZone(timestamp, timezone, 'yyyy-MM-dd HH:mm:ss'));

    switch (log.event_type) {
      case 'signin':
        if (isOnBreak) {
          // If on break and signing in, end the break
          if (breakStart) {
            breakPeriods.push({
              start: breakStart,
              end: timestampInTimezone
            });
            breakStart = null;
          }
          isOnBreak = false;
        }

        isActive = true;
        activeStart = timestampInTimezone;
        break;

      case 'signout':
        if (isActive && activeStart) {
          activePeriods.push({
            start: activeStart,
            end: timestampInTimezone
          });
          activeStart = null;
        }

        if (isOnBreak && breakStart) {
          breakPeriods.push({
            start: breakStart,
            end: timestampInTimezone
          });
          breakStart = null;
        }

        isActive = false;
        isOnBreak = false;
        break;

      case 'break_start':
        if (isActive && activeStart) {
          activePeriods.push({
            start: activeStart,
            end: timestampInTimezone
          });
          activeStart = null;
        }

        isOnBreak = true;
        breakStart = timestampInTimezone;
        break;

      case 'break_end':
        if (isOnBreak && breakStart) {
          breakPeriods.push({
            start: breakStart,
            end: timestampInTimezone
          });
          breakStart = null;
        }

        isOnBreak = false;
        isActive = true;
        activeStart = timestampInTimezone;
        break;
    }
  }

  // Close any open periods with current time
  if (isActive && activeStart) {
    activePeriods.push({
      start: activeStart,
      end: nowInTimezone
    });
  }

  if (isOnBreak && breakStart) {
    breakPeriods.push({
      start: breakStart,
      end: nowInTimezone
    });
  }

  // Calculate total work time in seconds
  const workTime = calculateTotalSeconds(activePeriods);

  // Calculate total break time in seconds
  const breakTime = calculateTotalSeconds(breakPeriods);

  // Calculate overtime (anything over 8 hours)
  const standardWorkdaySecs = 8 * 3600; // 8 hours in seconds
  const overtimeSeconds = Math.max(0, workTime - standardWorkdaySecs);

  return {
    userId: profile.id,
    fullName: profile.full_name || '',
    email: profile.email || '',
    role: profile.role || '',
    departmentId: profile.department_id,
    departmentName: null, // Will be populated later
    workTime,
    breakTime,
    overtimeSeconds,
    isActive,
    isOnBreak,
    lastActivity
  };
}

/**
 * Calculate total seconds from an array of time periods
 */
function calculateTotalSeconds(periods: TimePeriod[]): number {
  return periods.reduce((total, period) => {
    const startTime = period.start.getTime();
    const endTime = period.end.getTime();

    if (endTime <= startTime) return total;

    // Apply capping to prevent unreasonably long durations
    const { durationSeconds } = capShiftDuration(startTime, endTime);

    return total + durationSeconds;
  }, 0);
}

export async function GET(request: Request) {
  try {
    // Use the utility function to safely parse the URL
    const url = parseRequestUrl(request.url);
    const { searchParams } = url;
    const departmentId = searchParams.get('departmentId');
    const timezone = searchParams.get('timezone') || 'UTC';

    // Create authenticated Supabase client
    const supabase = await createClient();

    // Get user session
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user role
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('role, department_id')
      .eq('id', session.user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Only admin or manager can access team metrics
    if (userProfile.role !== 'admin' && userProfile.role !== 'manager') {
      return NextResponse.json({ error: 'Unauthorized to view team metrics' }, { status: 403 });
    }

    // Get department ID from query or use manager's department
    let deptId = departmentId;
    if (!deptId && userProfile.role === 'manager') {
      deptId = userProfile.department_id || '';
    }

    // Fetch team members
    let teamMembersQuery = supabase
      .from('profiles')
      .select('*');

    // Filter by department if specified
    if (deptId) {
      teamMembersQuery = teamMembersQuery.eq('department_id', deptId);
    }

    // Admin can see all employees, manager can only see their department
    if (userProfile.role === 'manager' && !deptId) {
      teamMembersQuery = teamMembersQuery.eq('department_id', userProfile.department_id);
    }

    const { data: teamMembers, error: teamError } = await teamMembersQuery;

    if (teamError) {
      console.error('Error fetching team members:', teamError);
      return NextResponse.json({ error: 'Failed to fetch team members' }, { status: 500 });
    }

    if (!teamMembers || teamMembers.length === 0) {
      return NextResponse.json({ employees: [] });
    }

    // Fetch departments for mapping
    const { data: departments } = await supabase
      .from('departments')
      .select('*');

    const departmentMap = new Map();
    if (departments) {
      departments.forEach(dept => {
        departmentMap.set(dept.id, dept.name);
      });
    }

    // Fetch attendance logs for all team members
    const teamUserIds = teamMembers.map(member => member.id);

    // Use the same date format as in the manager dashboard
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    const { data: allLogs, error: logsError } = await supabase
      .from('attendance_logs')
      .select('*')
      .in('user_id', teamUserIds)
      .gte('timestamp', `${todayStr}T00:00:00`)
      .lte('timestamp', `${todayStr}T23:59:59`)
      .order('timestamp', { ascending: true });

    if (logsError) {
      console.error('Error fetching attendance logs:', logsError);
      return NextResponse.json({ error: 'Failed to fetch attendance data' }, { status: 500 });
    }

    // Group logs by user
    const logsByUser: Record<string, AttendanceLog[]> = {};
    (allLogs || []).forEach(log => {
      if (!logsByUser[log.user_id]) {
        logsByUser[log.user_id] = [];
      }
      logsByUser[log.user_id].push(log);
    });

    // Calculate metrics for each team member
    const employeeMetrics: EmployeeMetrics[] = teamMembers.map(member => {
      const userLogs = logsByUser[member.id] || [];
      const metrics = calculateUserAttendanceMetrics(userLogs, timezone as string, member);

      // Add department name
      metrics.departmentName = member.department_id ? departmentMap.get(member.department_id) || null : null;

      return metrics;
    });

    // Return the metrics
    return NextResponse.json({ employees: employeeMetrics });
  } catch (error) {
    console.error('Error in team metrics API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
