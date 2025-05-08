import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import LoadingSpinner from '@/components/LoadingSpinner'
import { Suspense } from 'react'
import ClientWrapper from './ClientWrapper'
import { format } from 'date-fns'

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
    .order('timestamp', { ascending: true }) // Changed to ascending for time calculations

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
  const employeeStatuses: EmployeeStatus[] = [];
  const activeEmployeeIds = new Set<string>();

  if (allEmployees && todayLogs) {
    // Create a map of the latest status for each employee
    const latestStatusMap = new Map<string, { status: 'signed_in' | 'signed_out' | 'on_break', timestamp: string }>();

    // Create maps to track active periods and break periods
    const employeeActivePeriods = new Map<string, { start: Date, periods: { start: Date, end: Date }[] }>();
    const employeeBreakPeriods = new Map<string, { start: Date, periods: { start: Date, end: Date }[] }>();

    // Process logs chronologically to calculate active and break times
    todayLogs.forEach(log => {
      const timestamp = new Date(log.timestamp);
      const userId = log.user_id;

      // Update latest status
      let status: 'signed_in' | 'signed_out' | 'on_break' = 'signed_out';

      if (log.event_type === 'signin') {
        // Start tracking active time
        if (!employeeActivePeriods.has(userId)) {
          employeeActivePeriods.set(userId, { start: timestamp, periods: [] });
        } else if (!employeeActivePeriods.get(userId)!.start) {
          employeeActivePeriods.get(userId)!.start = timestamp;
        }

        status = 'signed_in';
        activeEmployeeIds.add(userId);
      }
      else if (log.event_type === 'signout') {
        // End active period if exists
        if (employeeActivePeriods.has(userId) && employeeActivePeriods.get(userId)!.start) {
          const activePeriod = employeeActivePeriods.get(userId)!;
          activePeriod.periods.push({
            start: activePeriod.start,
            end: timestamp
          });
          activePeriod.start = null as unknown as Date; // Clear start time
        }

        // End break period if exists
        if (employeeBreakPeriods.has(userId) && employeeBreakPeriods.get(userId)!.start) {
          const breakPeriod = employeeBreakPeriods.get(userId)!;
          breakPeriod.periods.push({
            start: breakPeriod.start,
            end: timestamp
          });
          breakPeriod.start = null as unknown as Date; // Clear start time
        }

        status = 'signed_out';
      }
      else if (log.event_type === 'break_start') {
        // End active period if exists
        if (employeeActivePeriods.has(userId) && employeeActivePeriods.get(userId)!.start) {
          const activePeriod = employeeActivePeriods.get(userId)!;
          activePeriod.periods.push({
            start: activePeriod.start,
            end: timestamp
          });
          activePeriod.start = null as unknown as Date; // Clear start time
        }

        // Start break period
        if (!employeeBreakPeriods.has(userId)) {
          employeeBreakPeriods.set(userId, { start: timestamp, periods: [] });
        } else {
          employeeBreakPeriods.get(userId)!.start = timestamp;
        }

        status = 'on_break';
        activeEmployeeIds.add(userId);
      }
      else if (log.event_type === 'break_end') {
        // End break period if exists
        if (employeeBreakPeriods.has(userId) && employeeBreakPeriods.get(userId)!.start) {
          const breakPeriod = employeeBreakPeriods.get(userId)!;
          breakPeriod.periods.push({
            start: breakPeriod.start,
            end: timestamp
          });
          breakPeriod.start = null as unknown as Date; // Clear start time
        }

        // Start active period
        if (!employeeActivePeriods.has(userId)) {
          employeeActivePeriods.set(userId, { start: timestamp, periods: [] });
        } else {
          employeeActivePeriods.get(userId)!.start = timestamp;
        }

        status = 'signed_in';
        activeEmployeeIds.add(userId);
      }

      // Update latest status
      if (!latestStatusMap.has(userId) ||
          new Date(latestStatusMap.get(userId)!.timestamp) < timestamp) {
        latestStatusMap.set(userId, { status, timestamp: log.timestamp });
      }
    });

    // Close any open periods with current time for employees still active
    const now = new Date();

    employeeActivePeriods.forEach((data, userId) => {
      if (data.start) {
        data.periods.push({ start: data.start, end: now });
      }
    });

    employeeBreakPeriods.forEach((data, userId) => {
      if (data.start) {
        data.periods.push({ start: data.start, end: now });
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
    allEmployees.forEach(employee => {
      // Skip if employee is undefined or doesn't have an id
      if (!employee || !employee.id) return;

      const latestStatus = latestStatusMap.get(employee.id);
      const totalActiveTime = employeeActivePeriods.has(employee.id)
        ? calculateTotalMinutes(employeeActivePeriods.get(employee.id)!.periods)
        : 0;

      const totalBreakTime = employeeBreakPeriods.has(employee.id)
        ? calculateTotalMinutes(employeeBreakPeriods.get(employee.id)!.periods)
        : 0;

      if (latestStatus) {
        employeeStatuses.push({
          id: employee.id,
          name: employee.full_name || 'Unnamed',
          status: latestStatus.status,
          lastActivity: getActivityLabel(latestStatus.status),
          lastActivityTime: format(new Date(latestStatus.timestamp), 'h:mm a'),
          department_id: employee.department_id || 'unassigned',
          totalActiveTime: Math.round(totalActiveTime),
          totalBreakTime: Math.round(totalBreakTime)
        });
      } else {
        employeeStatuses.push({
          id: employee.id,
          name: employee.full_name || 'Unnamed',
          status: 'signed_out',
          lastActivity: 'Not active today',
          lastActivityTime: '',
          department_id: employee.department_id || 'unassigned',
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

  // Helper function to get activity label
  function getActivityLabel(status: 'signed_in' | 'signed_out' | 'on_break'): string {
    switch (status) {
      case 'signed_in': return 'Signed In';
      case 'signed_out': return 'Signed Out';
      case 'on_break': return 'On Break';
    }
  }

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
    today
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
