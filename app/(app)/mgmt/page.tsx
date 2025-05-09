import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LoadingSpinner from '@/components/LoadingSpinner'
import { Suspense } from 'react'
import ClientWrapper from './ClientWrapper'
import { format, parseISO, isSameDay } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'

// Type for employee status
type EmployeeStatus = {
  id: string;
  name: string;
  status: 'signed_in' | 'signed_out' | 'on_break';
  lastActivity: string;
  lastActivityTime: string;
  totalActiveTime?: number; // Total active time in minutes
  totalBreakTime?: number; // Total break time in minutes
};

// Helper function to get all the data needed for the manager dashboard
async function getManagerDashboardData(supabase, user, managerProfile) {
  // Get current date for reference
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')
  // console.log(`Current date: ${todayStr} (not using for filtering)`)

  // --- Fetch Timezone Setting ---
  let timezone = 'UTC'; // Default timezone
  try {
    const { data: settings, error: tzError } = await supabase
      .from('app_settings')
      .select('timezone')
      .eq('id', 1)
      .single();

    if (tzError) {
      if (tzError.code !== 'PGRST116') { // Ignore row not found
        console.error("Error fetching timezone setting:", tzError);
      }
    } else if (settings?.timezone) {
      timezone = settings.timezone;
    }
  } catch (error) {
    console.error("Error fetching timezone setting:", error);
  }

  // Get manager's department first
  const { data: managerDeptProfile, error: managerDeptProfileError } = await supabase
    .from('profiles')
    .select('department_id')
    .eq('id', user.id)
    .single()

  if (managerDeptProfileError) {
    console.error('Error fetching manager department profile:', managerDeptProfileError)
  }

  // Check if department_id is null - if so, we'll show all employees

  // Get the manager's full profile
  const { data: managerFullProfile, error: managerFullProfileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (managerFullProfileError) {
    console.error('Error fetching manager full profile:', managerFullProfileError)
  }

  // Query for team members in the manager's department using two approaches
  let teamMembers = [];
  let teamMembersError = null;

  let departmentUserRoles = [];
  let departmentUserRolesError = null;
  let departmentProfiles = [];
  let departmentProfilesError = null;

  if (managerDeptProfile?.department_id) {
    // Approach 1: Get employees from user_roles table
    const { data: userRoles, error: userRolesError } = await supabase
      .from('user_roles')
      .select('user_id, role, department_id')
      .eq('department_id', managerDeptProfile.department_id);

    departmentUserRoles = userRoles || [];
    departmentUserRolesError = userRolesError;

    // Approach 2: Get employees directly from profiles table by department_id
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, department_id')
      .eq('department_id', managerDeptProfile.department_id);

    departmentProfiles = profiles || [];
    departmentProfilesError = profilesError;
  } else {
    // If manager has no department, get all employees
    const { data: allProfiles, error: allProfilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, department_id')
      .neq('id', user.id); // Exclude the current manager

    departmentProfiles = allProfiles || [];
    departmentProfilesError = allProfilesError;
  }

  // Process user_roles approach
  if (departmentUserRoles && departmentUserRoles.length > 0) {
    const userIds = departmentUserRoles.map(ur => ur.user_id);

    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, department_id')
      .in('id', userIds);

    if (profilesError) {
      console.error('Error fetching profiles from user_roles:', profilesError);
    } else if (profilesData) {
      // Combine the data
      const userRolesTeamMembers = departmentUserRoles.map(ur => {
        const profile = profilesData.find(p => p.id === ur.user_id);
        if (profile) {
          return {
            user_id: ur.user_id,
            role: ur.role,
            department_id: ur.department_id,
            profiles: profile
          };
        }
        return null;
      }).filter(Boolean); // Remove null entries

      teamMembers = [...teamMembers, ...userRolesTeamMembers];
    }
  } else if (departmentUserRolesError) {
    console.error('Error fetching department user roles:', departmentUserRolesError);
  }

  // Process profiles approach
  if (departmentProfiles && departmentProfiles.length > 0) {
    // Create team members from profiles
    const profilesTeamMembers = departmentProfiles.map(profile => ({
      user_id: profile.id,
      role: profile.role,
      department_id: profile.department_id,
      profiles: profile
    }));

    // Add to team members, avoiding duplicates
    const existingIds = new Set(teamMembers.map(tm => tm.user_id));
    const newMembers = profilesTeamMembers.filter(tm => !existingIds.has(tm.user_id));

    teamMembers = [...teamMembers, ...newMembers];
  } else if (departmentProfilesError) {
    console.error('Error fetching department profiles:', departmentProfilesError);
  }

  // Log the number of team members found
  // console.log(`Found ${teamMembers.length} team members in department ${managerDeptProfile?.department_id}`);

  // Log team member details for debugging
  // if (teamMembers.length > 0) {
  //   console.log('Team members:');
  //   teamMembers.forEach(member => {
  //     if (member && member.profiles) {
  //       console.log(`  ${member.profiles.id}: ${member.profiles.full_name} (${member.profiles.role})`);
  //     }
  //   });
  // }

  // Extract profile data from the joined query, filtering out undefined profiles
  const employeeProfiles = teamMembers
    .filter(member => member && member.profiles)
    .map(member => member.profiles) || [];

  // Combine the current user with team members, ensuring managerFullProfile is defined
  const employees = managerFullProfile ? [managerFullProfile, ...employeeProfiles] : [...employeeProfiles];

  // Get department info
  const { data: departments, error: departmentsError } = await supabase
    .from('departments')
    .select('id, name')

  if (departmentsError) {
    console.error('Error fetching departments:', departmentsError)
  }

  // Create a map of department IDs to names
  const departmentMap = new Map<string, string>()
  departments?.forEach(dept => {
    departmentMap.set(dept.id, dept.name)
  })

  // Variable to store the count of today's logs
  let todayLogsCount = 0;

  // Include all employees in the department, including the manager
  // Use a Set to ensure unique employee IDs
  const uniqueEmployeeIds = new Set<string>();
  const employeesInDepartment = employees?.filter(emp => {
    // Skip null/undefined employees
    if (!emp || !emp.id) return false;

    // Skip duplicate employees
    if (uniqueEmployeeIds.has(emp.id)) return false;

    // Add this employee ID to the set
    uniqueEmployeeIds.add(emp.id);
    return true;
  }) || [];

  // Get team member IDs
  const teamMemberIds = employeesInDepartment.map(emp => emp.id);

  // Get all attendance logs for team members
  let todayLogs = [];

  // Get today's logs for team members
  // console.log("Fetching today's logs for team members");
  // console.log(`Team member IDs: ${teamMemberIds.join(', ')}`);

  // Then get today's logs for these team members
  const { data: allLogs, error: logsError } = await supabase
    .from('attendance_logs')
    .select('id, user_id, event_type, timestamp')
    .in('user_id', teamMemberIds)
    .gte('timestamp', `${todayStr}T00:00:00`)
    .lte('timestamp', `${todayStr}T23:59:59`)
    .order('timestamp', { ascending: true });  // Changed to ascending for time calculations

  // Set todayLogsCount to the total number of logs
  if (logsError) {
    console.error('Error fetching logs:', logsError);
    todayLogsCount = 0;
  } else {
    todayLogs = allLogs || [];
    todayLogsCount = todayLogs.length;
    // console.log(`Fetched ${todayLogs.length} logs for team members`);

    // Log the first few logs for debugging
    // if (todayLogs.length > 0) {
    //   console.log('Logs sample:');
    //   todayLogs.slice(0, 5).forEach(log => {
    //     console.log(`  ${log.user_id}: ${log.event_type} at ${log.timestamp}`);
    //   });
    // }
  }

  // Get recent activity logs (last 20 entries) for team members
  let recentLogs = [];

  // First try to get logs for team members only
  if (teamMemberIds.length > 0) {
    // console.log(`Fetching recent logs for ${teamMemberIds.length} team members`);
    // console.log(`Team member IDs: ${teamMemberIds.join(', ')}`);

    const { data: teamLogs, error: teamLogsError } = await supabase
      .from('attendance_logs')
      .select('id, user_id, event_type, timestamp')
      .in('user_id', teamMemberIds)
      .order('timestamp', { ascending: false })
      .limit(20);

    if (teamLogsError) {
      console.error('Error fetching team recent logs:', teamLogsError);
    } else if (teamLogs && teamLogs.length > 0) {
      recentLogs = teamLogs;
      // console.log(`Fetched ${recentLogs.length} recent logs for team members`);

      // Log the first few logs for debugging
      // console.log('Recent team logs sample:');
      // recentLogs.slice(0, 3).forEach(log => {
      //   console.log(`  ${log.user_id}: ${log.event_type} at ${log.timestamp}`);
      // });
    } else {
      // console.log('No team logs found, fetching all recent logs instead');

      // If no team logs found, get all recent logs as a fallback
      const { data: allLogs, error: allLogsError } = await supabase
        .from('attendance_logs')
        .select('id, user_id, event_type, timestamp')
        .order('timestamp', { ascending: false })
        .limit(20);

      if (allLogsError) {
        console.error('Error fetching all recent logs:', allLogsError);
      } else if (allLogs) {
        recentLogs = allLogs;
        console.log(`Fetched ${recentLogs.length} recent logs (all users)`);

        // Log the first few logs for debugging
        if (recentLogs.length > 0) {
          console.log('Recent logs sample (all users):');
          recentLogs.slice(0, 3).forEach(log => {
            console.log(`  ${log.user_id}: ${log.event_type} at ${log.timestamp}`);
          });
        }
      }
    }
  } else {
    console.log('No team members found, fetching all recent logs');

    // If no team members, get all recent logs
    const { data: allLogs, error: allLogsError } = await supabase
      .from('attendance_logs')
      .select('id, user_id, event_type, timestamp')
      .order('timestamp', { ascending: false })
      .limit(20);

    if (allLogsError) {
      console.error('Error fetching all recent logs:', allLogsError);
    } else if (allLogs) {
      recentLogs = allLogs;
      console.log(`Fetched ${recentLogs.length} recent logs (all users)`);
    }
  }

  // Process employee status
  const employeeStatuses: EmployeeStatus[] = [];
  const activeEmployeeIds = new Set<string>();

  if (employeesInDepartment && todayLogs) {
    // Create a map of the latest status for each employee
    const latestStatusMap = new Map<string, { status: 'signed_in' | 'signed_out' | 'on_break', timestamp: string }>();

    // Create maps to track active periods and break periods
    const employeeActivePeriods = new Map<string, { start: Date, periods: { start: Date, end: Date }[] }>();
    const employeeBreakPeriods = new Map<string, { start: Date, periods: { start: Date, end: Date }[] }>();

    // For debugging, log all team member IDs
    // console.log(`Team member IDs (${teamMemberIds.length}): ${teamMemberIds.join(', ')}`);

    // For debugging, log all unique user IDs in logs
    const uniqueLogUserIds = [...new Set(todayLogs.map(log => log.user_id))];
    // console.log(`Unique log user IDs (${uniqueLogUserIds.length}): ${uniqueLogUserIds.join(', ')}`);

    // Check for overlap between team member IDs and log user IDs
    const overlap = teamMemberIds.filter(id => uniqueLogUserIds.includes(id));
    // console.log(`Overlap between team members and logs (${overlap.length}): ${overlap.join(', ')}`);

    // Filter logs to only include team members
    const teamMemberLogsOnly = todayLogs.filter(log => {
      const isTeamMember = teamMemberIds.includes(log.user_id);
      // if (isTeamMember) {
      //   console.log(`Including log for team member ${log.user_id}, event: ${log.event_type}, time: ${log.timestamp}`);
      // }
      return isTeamMember;
    });

    // console.log(`Filtered ${todayLogs.length} logs down to ${teamMemberLogsOnly.length} team member logs`);

    // Process logs chronologically to calculate active and break times
    teamMemberLogsOnly.forEach(log => {
      // Parse timestamp with timezone handling
      const timestamp = parseISO(log.timestamp);
      // Convert to the admin-set timezone for consistent calculations
      const timestampInTimezone = new Date(formatInTimeZone(timestamp, timezone, 'yyyy-MM-dd HH:mm:ss'));
      const userId = log.user_id;

      // For debugging, log all logs we're processing
      // console.log(`Processing log for ${userId}: ${log.event_type} at ${format(timestamp, 'yyyy-MM-dd HH:mm:ss')}`);

      // For overnight shifts, we don't filter by day
      // This ensures that shifts that cross midnight are properly calculated

      // Update latest status
      let status: 'signed_in' | 'signed_out' | 'on_break' = 'signed_out';

      if (log.event_type === 'signin') {
        // Update status and track active employees
        status = 'signed_in';
        activeEmployeeIds.add(userId);

        // Start tracking active time - handle overnight shifts
        if (!employeeActivePeriods.has(userId)) {
          employeeActivePeriods.set(userId, { start: timestampInTimezone, periods: [] });
        } else if (!employeeActivePeriods.get(userId)!.start) {
          employeeActivePeriods.get(userId)!.start = timestampInTimezone;
        }
      }
      else if (log.event_type === 'signout') {
        // Update status
        status = 'signed_out';

        // End active period if exists - handle overnight shifts
        if (employeeActivePeriods.has(userId) && employeeActivePeriods.get(userId)!.start) {
          const activePeriod = employeeActivePeriods.get(userId)!;
          activePeriod.periods.push({
            start: activePeriod.start,
            end: timestampInTimezone
          });
          activePeriod.start = null as unknown as Date; // Clear start time
        }

        // End break period if exists
        if (employeeBreakPeriods.has(userId) && employeeBreakPeriods.get(userId)!.start) {
          const breakPeriod = employeeBreakPeriods.get(userId)!;
          breakPeriod.periods.push({
            start: breakPeriod.start,
            end: timestampInTimezone
          });
          breakPeriod.start = null as unknown as Date; // Clear start time
        }
      }
      else if (log.event_type === 'break_start') {
        // Update status and track active employees
        status = 'on_break';
        activeEmployeeIds.add(userId);

        // End active period if exists
        if (employeeActivePeriods.has(userId) && employeeActivePeriods.get(userId)!.start) {
          const activePeriod = employeeActivePeriods.get(userId)!;
          activePeriod.periods.push({
            start: activePeriod.start,
            end: timestampInTimezone
          });
          activePeriod.start = null as unknown as Date; // Clear start time
        }

        // Start break period
        if (!employeeBreakPeriods.has(userId)) {
          employeeBreakPeriods.set(userId, { start: timestampInTimezone, periods: [] });
        } else {
          employeeBreakPeriods.get(userId)!.start = timestampInTimezone;
        }
      }
      else if (log.event_type === 'break_end') {
        // Update status and track active employees
        status = 'signed_in';
        activeEmployeeIds.add(userId);

        // End break period if exists
        if (employeeBreakPeriods.has(userId) && employeeBreakPeriods.get(userId)!.start) {
          const breakPeriod = employeeBreakPeriods.get(userId)!;
          breakPeriod.periods.push({
            start: breakPeriod.start,
            end: timestampInTimezone
          });
          breakPeriod.start = null as unknown as Date; // Clear start time
        }

        // Start active period
        if (!employeeActivePeriods.has(userId)) {
          employeeActivePeriods.set(userId, { start: timestampInTimezone, periods: [] });
        } else {
          employeeActivePeriods.get(userId)!.start = timestampInTimezone;
        }
      }

      // Update latest status
      if (!latestStatusMap.has(userId) ||
          new Date(formatInTimeZone(parseISO(latestStatusMap.get(userId)!.timestamp), timezone, 'yyyy-MM-dd HH:mm:ss')) < timestampInTimezone) {
        latestStatusMap.set(userId, { status, timestamp: log.timestamp });
      }
    });

    // Close any open periods with current time for employees still active
    const now = new Date();
    // Convert current time to the admin-set timezone for consistent calculations
    const nowInTimezone = new Date(formatInTimeZone(now, timezone, 'yyyy-MM-dd HH:mm:ss'));

    employeeActivePeriods.forEach((data, userId) => {
      if (data.start) {
        data.periods.push({ start: data.start, end: nowInTimezone });
      }
    });

    employeeBreakPeriods.forEach((data, userId) => {
      if (data.start) {
        data.periods.push({ start: data.start, end: nowInTimezone });
      }
    });

    // Calculate total times for each employee
    const calculateTotalMinutes = (periods: { start: Date, end: Date }[]): number => {
      return periods.reduce((total, period) => {
        const minutes = (period.end.getTime() - period.start.getTime()) / (1000 * 60);
        return total + minutes;
      }, 0);
    };

    // Create employee status objects
    employeesInDepartment.forEach(employee => {
      // Skip if employee is undefined or doesn't have an id
      if (!employee || !employee.id) return;

      // console.log(`Processing employee: ${employee.full_name} (${employee.id})`);

      const latestStatus = latestStatusMap.get(employee.id);
      // console.log(`  Latest status: ${latestStatus ? latestStatus.status : 'none'}`);

      // Calculate active time, ensure it's not negative
      const totalActiveTime = employeeActivePeriods.has(employee.id)
        ? Math.max(0, calculateTotalMinutes(employeeActivePeriods.get(employee.id)!.periods))
        : 0;

      // Calculate break time, ensure it's not negative
      const totalBreakTime = employeeBreakPeriods.has(employee.id)
        ? Math.max(0, calculateTotalMinutes(employeeBreakPeriods.get(employee.id)!.periods))
        : 0;

      // console.log(`  Active time: ${totalActiveTime} minutes, Break time: ${totalBreakTime} minutes`);

      if (latestStatus) {
        // console.log(`  Adding employee with status: ${latestStatus.status}`);
        employeeStatuses.push({
          id: employee.id,
          name: employee.full_name || 'Unnamed',
          status: latestStatus.status,
          lastActivity: getActivityLabel(latestStatus.status),
          lastActivityTime: formatInTimeZone(parseISO(latestStatus.timestamp), timezone, 'h:mm a'),
          totalActiveTime: Math.round(totalActiveTime),
          totalBreakTime: Math.round(totalBreakTime)
        });
      } else {
        // console.log(`  Adding employee as signed out`);
        employeeStatuses.push({
          id: employee.id,
          name: employee.full_name || 'Unnamed',
          status: 'signed_out',
          lastActivity: 'No activity recorded',
          lastActivityTime: '',
          totalActiveTime: 0,
          totalBreakTime: 0
        });
      }
    });
  }

  // Sort employee statuses: active first, then by name
  employeeStatuses.sort((a, b) => {
    // Active employees first
    if (a.status !== 'signed_out' && b.status === 'signed_out') return -1;
    if (a.status === 'signed_out' && b.status !== 'signed_out') return 1;

    // Then sort by name
    return a.name.localeCompare(b.name);
  });

  const activeEmployeeCount = activeEmployeeIds.size;





  // Helper function to get activity label
  function getActivityLabel(status: 'signed_in' | 'signed_out' | 'on_break'): string {
    switch (status) {
      case 'signed_in': return 'Signed In';
      case 'signed_out': return 'Signed Out';
      case 'on_break': return 'On Break';
    }
  }

  return {
    employeeStatuses,
    employeesInDepartment,
    activeEmployeeCount,
    todayLogsCount,
    departmentMap,
    managerProfile: managerDeptProfile,
    recentLogs,
    today,
    timezone
  };
}

export default async function ManagerDashboard() {
  const supabase = await createClient()

  // Get user and check if they're logged in
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  // Get manager's profile
  const { data: managerProfile, error: managerProfileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (managerProfileError) {
    console.error('Error fetching manager profile:', managerProfileError)
    return <div>Error loading profile. Please try again.</div>
  }

  // Check if user is a manager or admin
  if (managerProfile.role !== 'manager' && managerProfile.role !== 'admin') {
    return redirect('/?message=You do not have permission to access this page.')
  }

  // Wrap the content in Suspense to show loading indicator
  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><LoadingSpinner size="lg" /></div>}>
      <ClientWrapper initialData={await getManagerDashboardData(supabase, user, managerProfile)} />
    </Suspense>
  );
}
