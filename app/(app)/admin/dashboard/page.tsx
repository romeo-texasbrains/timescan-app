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

  // Get all departments
  const { data: departments, error: departmentsError } = await supabase
    .from('departments')
    .select('id, name')
    .order('name')

  if (departmentsError) {
    console.error('Error fetching departments:', departmentsError)
  }

  // Create a map of department IDs to names
  const departmentMap = new Map<string, string>()
  departments?.forEach(dept => {
    departmentMap.set(dept.id, dept.name)
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
      allEmployees.forEach(employee => {
        const userLogs = logsByUser[employee.id] || [];
        const metrics = calculateUserAttendanceMetrics(userLogs, timezone, employee.id);
        userMetricsMap.set(employee.id, metrics);
      });

        // Create employee status objects
        employeeStatuses = allEmployees.map(employee => {
          const metrics = userMetricsMap.get(employee.id);

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
              totalBreakTime: metrics.breakTime  // Keep as seconds to match client-side
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
              totalBreakTime: 0
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
        totalBreakTime: 0
      }));
    }
  }

  // Sort employee statuses: active first, then by name
  employeeStatuses.sort((a, b) => {
    // Active employees first
    if (a.status !== 'signed_out' && b.status === 'signed_out') return -1;
    if (a.status === 'signed_out' && b.status !== 'signed_out') return 1;

    // Then sort by name
    return a.name.localeCompare(b.name);
  });

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

  // Convert departmentMap to a regular object for serialization
  const departmentMapObj: Record<string, string> = {};
  departmentMap.forEach((name, id) => {
    departmentMapObj[id] = name;
  });

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
    const dashboardData = await getAdminDashboardData(supabase, user, adminProfile);

    // Wrap the content in Suspense to show loading indicator
    return (
      <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><LoadingSpinner size="lg" /></div>}>
        <ClientWrapper initialData={dashboardData} />
      </Suspense>
    );
  } catch (error) {
    console.error('Error fetching admin dashboard data:', error);
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
