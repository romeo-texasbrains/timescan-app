import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LoadingSpinner from '@/components/LoadingSpinner'
import { Suspense } from 'react'
import ClientWrapper from './ClientWrapper'
import { format, parseISO, isSameDay } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { calculateUserAttendanceMetrics } from '@/lib/utils/metrics-calculator'

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

  // Initialize all variables at the beginning to avoid reference errors
  let departmentUserRoles = [];
  let departmentUserRolesError = null;
  let departmentProfiles = [];
  let departmentProfilesError = null;
  let teamMembers = [];
  let todayLogsCount = 0;
  let recentLogs = [];
  let employeeStatuses = [];
  let activeEmployeeCount = 0;

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

  // Get the manager's full profile
  const { data: managerFullProfile, error: managerFullProfileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (managerFullProfileError) {
    console.error('Error fetching manager full profile:', managerFullProfileError)
  }

  // Variables already initialized at the beginning of the function

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

  // Get department info with shift settings
  const { data: departments, error: departmentsError } = await supabase
    .from('departments')
    .select('id, name, shift_start_time, shift_end_time, grace_period_minutes')

  if (departmentsError) {
    console.error('Error fetching departments:', departmentsError)
  }

  // Create a map of department IDs to department info
  const departmentMap = new Map<string, any>()
  departments?.forEach(dept => {
    departmentMap.set(dept.id, {
      name: dept.name,
      shift_start_time: dept.shift_start_time || '09:00:00',
      shift_end_time: dept.shift_end_time || '17:00:00',
      grace_period_minutes: dept.grace_period_minutes || 30
    })
  })

  // Get today's logs count
  const todayStr = format(today, 'yyyy-MM-dd');
  const { count: todayCount, error: todayCountError } = await supabase
    .from('attendance_logs')
    .select('*', { count: 'exact', head: true })
    .gte('timestamp', `${todayStr}T00:00:00`)
    .lte('timestamp', `${todayStr}T23:59:59`);

  if (todayCountError) {
    console.error('Error fetching today\'s logs count:', todayCountError);
  } else if (todayCount !== null) {
    todayLogsCount = todayCount;
  }

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

  // We're now using the API to get metrics, so we don't need to fetch logs directly

  // Get recent activity logs (last 20 entries) for team members
  // recentLogs already initialized at the beginning of the function

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

  // Process employee status (variables already initialized at the beginning of the function)
  // Explicitly set the type for employeeStatuses
  employeeStatuses = [] as EmployeeStatus[];

  if (employeesInDepartment) {
    // Calculate metrics directly for each employee
    try {
      // Get today's attendance logs only - use the same todayStr as defined earlier
      const { data: allLogs, error: allLogsError } = await supabase
        .from('attendance_logs')
        .select('*')
        .gte('timestamp', `${todayStr}T00:00:00`)
        .lte('timestamp', `${todayStr}T23:59:59`)
        .order('timestamp', { ascending: true });

      if (allLogsError) {
        throw new Error(`Failed to fetch attendance logs: ${allLogsError.message}`);
      }

      // Group logs by user ID
      const logsByUser = {};
      allLogs?.forEach(log => {
        if (!logsByUser[log.user_id]) {
          logsByUser[log.user_id] = [];
        }
        logsByUser[log.user_id].push(log);
      });

      // Fetch adherence status for all employees for today
      const { data: adherenceData, error: adherenceError } = await supabase
        .from('attendance_adherence')
        .select('*')
        .eq('date', todayStr);

      if (adherenceError) {
        console.error('Error fetching adherence data:', adherenceError);
      }

      // Create a map of user IDs to adherence status
      const userAdherenceMap = new Map();
      adherenceData?.forEach(record => {
        userAdherenceMap.set(record.user_id, record);
      });

      // Calculate metrics for each employee
      employeeStatuses = await Promise.all(employeesInDepartment.map(async employee => {
        const userLogs = logsByUser[employee.id] || [];
        const metrics = calculateUserAttendanceMetrics(userLogs, timezone, employee.id);

        // Get adherence data for this employee
        let adherence = userAdherenceMap.get(employee.id);

        // If no adherence record exists, calculate it
        if (!adherence) {
          try {
            const { data: adherenceStatus, error: calcError } = await supabase
              .rpc('calculate_adherence_status', {
                p_user_id: employee.id,
                p_date: todayStr
              });

            if (calcError) {
              console.error(`Error calculating adherence for ${employee.id}:`, calcError);
            } else if (adherenceStatus) {
              adherence = {
                user_id: employee.id,
                date: todayStr,
                status: adherenceStatus
              };
            }
          } catch (error) {
            console.error(`Error calculating adherence for ${employee.id}:`, error);
          }
        }

        // Check absent eligibility for late employees
        let eligibleForAbsent = false;
        if (adherence?.status === 'late') {
          try {
            const { data: eligibility, error: eligibilityError } = await supabase
              .rpc('check_absent_eligibility', {
                p_user_id: employee.id,
                p_date: todayStr
              });

            if (eligibilityError) {
              console.error(`Error checking absent eligibility for ${employee.id}:`, eligibilityError);
            } else {
              eligibleForAbsent = eligibility;
            }
          } catch (error) {
            console.error(`Error checking absent eligibility for ${employee.id}:`, error);
          }
        }

        return {
          id: employee.id,
          name: employee.full_name || 'Unnamed',
          status: metrics.isOnBreak ? 'on_break' : metrics.isActive ? 'signed_in' : 'signed_out',
          lastActivity: metrics.lastActivity ?
            (metrics.lastActivity.type === 'break_start' ? 'On Break' :
             metrics.lastActivity.type === 'signin' ? 'Signed In' :
             metrics.lastActivity.type === 'break_end' ? 'Signed In' : 'Signed Out')
            : 'No activity recorded',
          lastActivityTime: metrics.lastActivity ?
            formatInTimeZone(parseISO(metrics.lastActivity.timestamp), timezone, 'h:mm a') : '',
          totalActiveTime: metrics.workTime, // Keep as seconds to match client-side
          totalBreakTime: metrics.breakTime,  // Keep as seconds to match client-side
          adherence: adherence?.status || null,
          eligible_for_absent: eligibleForAbsent
        };
      }));

        // Count active employees
        activeEmployeeCount = employeeStatuses.filter(emp => emp.status !== 'signed_out').length;
    } catch (error) {
      console.error('Error fetching team metrics:', error);
      // Fallback to empty arrays if API fails
      employeeStatuses = [];
      activeEmployeeCount = 0;
    }
  }

  // Sort employee statuses: active first, then by name - with robust error handling
  try {
    employeeStatuses.sort((a, b) => {
      try {
        // Active employees first
        if (a.status !== 'signed_out' && b.status === 'signed_out') return -1;
        if (a.status === 'signed_out' && b.status !== 'signed_out') return 1;

        // Then sort by name - with defensive programming
        // Ensure both names are strings
        const nameA = typeof a.name === 'string' ? a.name : String(a.name || a.id || '');
        const nameB = typeof b.name === 'string' ? b.name : String(b.name || b.id || '');

        // Use simple string comparison instead of localeCompare
        return nameA > nameB ? 1 : nameA < nameB ? -1 : 0;
      } catch (innerError) {
        console.error('Error comparing employees:', innerError, { a, b });
        return 0; // Keep original order if comparison fails
      }
    });
  } catch (sortError) {
    console.error('Error sorting employees:', sortError);
    // If sorting fails, at least we still have the unsorted array
  }

  // activeEmployeeCount is now set in the API fetch section





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

  // Fetch data with error handling
  try {
    // Use the unified API endpoint to fetch dashboard data
    // For server components, we can directly call the API handler
    const { cookies } = await import('next/headers');
    const { createClient } = await import('@/lib/supabase/server');

    // Create a server client with the cookies
    const apiSupabase = await createClient();

    // Call our API handler directly
    const { GET } = await import('@/app/api/dashboard/data/route');
    const response = await GET(new Request('http://localhost:3000/api/dashboard/data'));

    if (!response.ok) {
      throw new Error(`Failed to fetch dashboard data: ${response.statusText}`);
    }

    const dashboardData = await response.json();
    console.log('Server-side: Successfully fetched dashboard data from API for manager dashboard');

    // Wrap the content in Suspense to show loading indicator
    return (
      <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><LoadingSpinner size="lg" /></div>}>
        <ClientWrapper initialData={dashboardData} />
      </Suspense>
    );
  } catch (error) {
    console.error('Error fetching manager dashboard data:', error);

    // Fallback to the original method if the API call fails
    try {
      console.log('Server-side: Falling back to direct data fetching method for manager dashboard');
      const dashboardData = await getManagerDashboardData(supabase, user, managerProfile);

      return (
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><LoadingSpinner size="lg" /></div>}>
          <ClientWrapper initialData={dashboardData} />
        </Suspense>
      );
    } catch (fallbackError) {
      console.error('Error in fallback data fetching for manager dashboard:', fallbackError);

      return (
        <div className="container mx-auto p-6">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
            <h2 className="text-lg font-semibold mb-2">Error Loading Dashboard</h2>
            <p>There was a problem loading the dashboard data. Please try refreshing the page or contact support if the issue persists.</p>
            <p className="text-sm mt-2">Error details: {error instanceof Error ? error.message : 'Unknown error'}</p>
          </div>
          <div className="flex justify-center mt-4">
            <a href="/" className="px-4 py-2 bg-primary text-primary-foreground rounded-md">
              Return to Home
            </a>
          </div>
        </div>
      );
    }
  }
}
