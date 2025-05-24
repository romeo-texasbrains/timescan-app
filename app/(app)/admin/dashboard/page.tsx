import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LoadingSpinner from '@/components/LoadingSpinner'
import { Suspense } from 'react'
import ClientWrapper from './ClientWrapper'
import { format, parseISO } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { determineUserStatus, getStatusLabel } from '@/lib/utils/statusDetermination'
import { calculateUserAttendanceMetrics } from '@/lib/utils/metrics-calculator'

// Type for employee status
type EmployeeStatus = {
  id: string;
  name: string;
  status: 'signed_in' | 'signed_out' | 'on_break';
  lastActivity: string;
  lastActivityTime: string;
  department_id: string;
  totalActiveTime: number; // Total active time in minutes
  totalBreakTime: number; // Total break time in minutes
};

// Helper function to get all the data needed for the admin dashboard
async function getAdminDashboardData(supabase, user, adminProfile) {
  // Get today's date in ISO format for filtering
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')

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

  // Get all departments with shift settings
  const { data: departments, error: departmentsError } = await supabase
    .from('departments')
    .select('id, name, shift_start_time, shift_end_time, grace_period_minutes')
    .order('name')

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

  // Get all employees (excluding the current admin user)
  const { data: allEmployees, error: employeesError } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, department_id')
    .neq('id', user.id) // Exclude the current admin
    .order('full_name')

  if (employeesError) {
    console.error('Error fetching employees:', employeesError)
  }

  // Get count of today's attendance logs
  const { count: todayLogsCount, error: logsError } = await supabase
    .from('attendance_logs')
    .select('*', { count: 'exact', head: true })
    .gte('timestamp', `${todayStr}T00:00:00`)
    .lte('timestamp', `${todayStr}T23:59:59`)

  // Get today's attendance logs for all employees
  const { data: todayLogs, error: todayLogsError } = await supabase
    .from('attendance_logs')
    .select('id, user_id, event_type, timestamp')
    .gte('timestamp', `${todayStr}T00:00:00`)
    .lte('timestamp', `${todayStr}T23:59:59`)
    .order('timestamp', { ascending: true }); // Changed to ascending for time calculations

  if (todayLogsError) {
    console.error('Error fetching today logs:', todayLogsError);
  }

  // Get recent activity logs (last 20 entries) for all employees
  const { data: recentLogs, error: recentLogsError } = await supabase
    .from('attendance_logs')
    .select('id, user_id, event_type, timestamp')
    .order('timestamp', { ascending: false })
    .limit(20);

  if (recentLogsError) {
    console.error('Error fetching recent logs:', recentLogsError);
  }

  // Process employee status
  let employeeStatuses: EmployeeStatus[] = [];
  let activeEmployeeCount = 0;

  if (allEmployees) {
    // Calculate metrics directly for each employee
    try {
      // Get only today's attendance logs for metrics calculation
      const { data: allLogs, error: allLogsError } = await supabase
        .from('attendance_logs')
        .select('*')
        .gte('timestamp', `${todayStr}T00:00:00`)
        .lte('timestamp', `${todayStr}T23:59:59`)
        .order('timestamp', { ascending: true });

      if (allLogsError) {
        throw new Error(`Failed to fetch attendance logs: ${allLogsError.message}`);
      }

      console.log(`Server-side: Fetched ${allLogs?.length || 0} attendance logs for today (${todayStr})`);

      // Group logs by user ID
      const logsByUser = {};
      allLogs?.forEach(log => {
        if (!logsByUser[log.user_id]) {
          logsByUser[log.user_id] = [];
        }
        logsByUser[log.user_id].push(log);
      });

      // Calculate metrics for each employee
      const userMetricsMap = new Map();
      const userAdherenceMap = new Map();

      // Fetch adherence status for all employees for today
      const { data: adherenceData, error: adherenceError } = await supabase
        .from('attendance_adherence')
        .select('*')
        .eq('date', todayStr);

      if (adherenceError) {
        console.error('Error fetching adherence data:', adherenceError);
      } else {
        // Create a map of user IDs to adherence status
        adherenceData?.forEach(record => {
          userAdherenceMap.set(record.user_id, record);
        });
      }

      // For employees without adherence records, calculate it
      for (const employee of allEmployees) {
        // Calculate metrics
        const userLogs = logsByUser[employee.id] || [];
        const metrics = calculateUserAttendanceMetrics(userLogs, timezone, employee.id);
        userMetricsMap.set(employee.id, metrics);

        // If no adherence record exists, calculate it
        if (!userAdherenceMap.has(employee.id)) {
          try {
            const { data: adherenceStatus, error: calcError } = await supabase
              .rpc('calculate_adherence_status', {
                p_user_id: employee.id,
                p_date: todayStr
              });

            if (calcError) {
              console.error(`Error calculating adherence for ${employee.id}:`, calcError);
            } else if (adherenceStatus) {
              userAdherenceMap.set(employee.id, {
                user_id: employee.id,
                date: todayStr,
                status: adherenceStatus
              });
            }
          } catch (error) {
            console.error(`Error calculating adherence for ${employee.id}:`, error);
          }
        }

        // Check absent eligibility for late employees
        const adherence = userAdherenceMap.get(employee.id);
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
              // Add eligibility to the adherence record
              adherence.eligible_for_absent = eligibility;
            }
          } catch (error) {
            console.error(`Error checking absent eligibility for ${employee.id}:`, error);
          }
        }
      }

        // Create employee status objects
        employeeStatuses = allEmployees.map(employee => {
          const metrics = userMetricsMap.get(employee.id);
          const adherence = userAdherenceMap.get(employee.id);

          if (metrics) {
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
              department_id: employee.department_id || 'unassigned',
              totalActiveTime: metrics.workTime, // Keep as seconds to match client-side
              totalBreakTime: metrics.breakTime,  // Keep as seconds to match client-side
              adherence: adherence?.status || null,
              eligible_for_absent: adherence?.eligible_for_absent || false
            };
          } else {
            return {
              id: employee.id,
              name: employee.full_name || 'Unnamed',
              status: 'signed_out',
              lastActivity: 'Not active today',
              lastActivityTime: '',
              department_id: employee.department_id || 'unassigned',
              totalActiveTime: 0,
              totalBreakTime: 0,
              adherence: adherence?.status || null,
              eligible_for_absent: adherence?.eligible_for_absent || false
            };
          }
        });

        // Count active employees
        activeEmployeeCount = employeeStatuses.filter(emp => emp.status !== 'signed_out').length;
    } catch (error) {
      console.error('Error fetching metrics:', error);

      // Fallback: Create basic employee status objects without metrics
      employeeStatuses = allEmployees.map(employee => ({
        id: employee.id,
        name: employee.full_name || 'Unnamed',
        status: 'signed_out',
        lastActivity: 'No activity recorded',
        lastActivityTime: '',
        department_id: employee.department_id || 'unassigned',
        totalActiveTime: 0,
        totalBreakTime: 0,
        adherence: null,
        eligible_for_absent: false
      }));
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

  // Group employees by department - using a regular object instead of Map for better serialization
  const employeesByDepartmentObj: Record<string, EmployeeStatus[]> = {
    'unassigned': []
  };

  // Initialize with all departments
  departments?.forEach(dept => {
    if (dept.id) {
      employeesByDepartmentObj[dept.id] = [];
    }
  });

  // Populate departments with employees
  employeeStatuses.forEach(employee => {
    const deptId = employee.department_id || 'unassigned';
    if (!employeesByDepartmentObj[deptId]) {
      employeesByDepartmentObj[deptId] = [];
    }
    employeesByDepartmentObj[deptId].push(employee);
  });

  // We're now using the imported getStatusLabel function from our utility

  // Convert departmentMap to a regular object for serialization with robust error handling
  const departmentMapObj: Record<string, any> = {};

  try {
    // Process each department with validation
    departmentMap.forEach((deptInfo, id) => {
      if (!id) return; // Skip if ID is missing

      try {
        // Default department structure
        const sanitizedDept = {
          name: 'Unknown Department',
          shift_start_time: null,
          shift_end_time: null,
          grace_period_minutes: 30
        };

        // Extract and validate department info
        if (deptInfo) {
          // Handle name with validation
          if (deptInfo.name !== undefined && deptInfo.name !== null) {
            sanitizedDept.name = String(deptInfo.name);
          } else {
            sanitizedDept.name = `Department ${id}`;
          }

          // Handle other properties
          if (deptInfo.shift_start_time) sanitizedDept.shift_start_time = deptInfo.shift_start_time;
          if (deptInfo.shift_end_time) sanitizedDept.shift_end_time = deptInfo.shift_end_time;
          if (typeof deptInfo.grace_period_minutes === 'number') {
            sanitizedDept.grace_period_minutes = deptInfo.grace_period_minutes;
          }
        }

        // Store the sanitized department
        departmentMapObj[id] = sanitizedDept;
      } catch (deptError) {
        console.error(`Error processing department ${id}:`, deptError);
        // Add a fallback department entry
        departmentMapObj[id] = {
          name: `Department ${id}`,
          shift_start_time: null,
          shift_end_time: null,
          grace_period_minutes: 30
        };
      }
    });

    // Add special handling for 'unassigned' department
    departmentMapObj['unassigned'] = {
      name: 'Unassigned',
      shift_start_time: null,
      shift_end_time: null,
      grace_period_minutes: 30
    };
  } catch (error) {
    console.error('Error creating department map object:', error);
    // Ensure we at least have the unassigned department
    departmentMapObj['unassigned'] = {
      name: 'Unassigned',
      shift_start_time: null,
      shift_end_time: null,
      grace_period_minutes: 30
    };
  }

  return {
    employeeStatuses,
    employeesByDepartment: employeesByDepartmentObj,
    allEmployees,
    activeEmployeeCount,
    todayLogsCount,
    departmentMap: departmentMapObj,
    recentLogs,
    today,
    timezone
  };
}

export default async function AdminDashboard() {
  const supabase = await createClient()

  // Get user and check if they're logged in
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  // Get admin's profile
  const { data: adminProfile, error: adminProfileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (adminProfileError) {
    console.error('Error fetching admin profile:', adminProfileError)
    return <div>Error loading profile. Please try again.</div>
  }

  // Check if user is an admin
  if (adminProfile.role !== 'admin') {
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

    // Call our dashboard API handler directly
    const { GET: getDashboardData } = await import('@/app/api/dashboard/data/route');
    const dashboardResponse = await getDashboardData(new Request('http://localhost:3000/api/dashboard/data'));

    if (!dashboardResponse.ok) {
      throw new Error(`Failed to fetch dashboard data: ${dashboardResponse.statusText}`);
    }

    const dashboardData = await dashboardResponse.json();
    console.log('Server-side: Successfully fetched dashboard data from API');

    // Call our recent activity API handler directly
    const { GET: getRecentActivity } = await import('@/app/api/activity/recent/route');
    const activityResponse = await getRecentActivity(new Request('http://localhost:3000/api/activity/recent?limit=20'));

    if (!activityResponse.ok) {
      console.warn(`Failed to fetch recent activity: ${activityResponse.statusText}`);
      // Continue without recent activity data
    } else {
      const activityData = await activityResponse.json();
      console.log('Server-side: Successfully fetched recent activity from API');

      // Merge recent activity data with dashboard data
      dashboardData.recentLogs = activityData.logs || [];
    }

    // Wrap the content in Suspense to show loading indicator
    return (
      <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><LoadingSpinner size="lg" /></div>}>
        <ClientWrapper initialData={dashboardData} />
      </Suspense>
    );
  } catch (error) {
    console.error('Error fetching admin dashboard data:', error);

    // Fallback to the original method if the API call fails
    try {
      console.log('Server-side: Falling back to direct data fetching method');
      const dashboardData = await getAdminDashboardData(supabase, user, adminProfile);

      return (
        <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><LoadingSpinner size="lg" /></div>}>
          <ClientWrapper initialData={dashboardData} />
        </Suspense>
      );
    } catch (fallbackError) {
      console.error('Error in fallback data fetching:', fallbackError);

      return (
        <div className="container mx-auto p-6">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
            <h2 className="text-lg font-semibold mb-2">Error Loading Dashboard</h2>
            <p>There was a problem loading the dashboard data. Please try refreshing the page or contact support if the issue persists.</p>
            <p className="text-sm mt-2">Error details: {error instanceof Error ? error.message : 'Unknown error'}</p>
          </div>
          <div className="flex justify-center mt-4">
            <a href="/admin" className="px-4 py-2 bg-primary text-primary-foreground rounded-md">
              Return to Admin Panel
            </a>
          </div>
        </div>
      );
    }
  }
}
