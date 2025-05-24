import { NextRequest, NextResponse } from 'next/server';
import { format } from 'date-fns';
import { getAuthenticatedUser } from '@/lib/auth/session';
import {
  getUsers,
  getDepartments,
  getAttendanceLogs,
  getAttendanceLogsCount,
  getAdherenceRecords,
  getAppSettings,
  getManagerAssignedDepartments
} from '@/lib/db/queries';
import { calculateUserAttendanceMetrics } from '@/lib/utils/metrics-calculator';
import { determineAdherenceStatus, checkAbsentEligibility } from '@/lib/utils/adherence-calculator';
import { formatTimestamp } from '@/lib/utils/time-formatter';
import { createClient } from '@/lib/supabase/server';

/**
 * GET handler for the dashboard data API
 * Returns dashboard data based on the user's role
 */
export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user
    const session = await getAuthenticatedUser();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has appropriate role
    if (session.role !== 'admin' && session.role !== 'manager') {
      return NextResponse.json({ error: 'Unauthorized access' }, { status: 403 });
    }

    // Get today's date in ISO format for filtering
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    // --- Fetch App Settings (Timezone) ---
    const settings = await getAppSettings();
    const timezone = settings.timezone || 'UTC';

    // --- Fetch Departments ---
    const departments = await getDepartments();

    // Create department map
    const departmentMap = {};
    departments.forEach(dept => {
      departmentMap[dept.id] = {
        name: dept.name,
        shift_start_time: dept.shift_start_time || '09:00:00',
        shift_end_time: dept.shift_end_time || '17:00:00',
        grace_period_minutes: dept.grace_period_minutes || 30
      };
    });

    // Ensure 'unassigned' department exists
    departmentMap['unassigned'] = {
      name: 'Unassigned',
      shift_start_time: null,
      shift_end_time: null,
      grace_period_minutes: 30
    };

    // --- Fetch Employees based on user role ---
    let employees;

    if (session.role === 'admin') {
      // Admin can see all employees
      employees = await getUsers({ excludeUserId: session.id });
    } else if (session.role === 'manager') {
      // Manager can only see employees in their assigned departments
      const managerDepartments = await getManagerAssignedDepartments(session.id);

      if (managerDepartments.length > 0) {
        const departmentIds = managerDepartments.map(dept => dept.id);
        console.log(`Manager is assigned to departments: ${departmentIds.join(', ')}`);

        employees = await getUsers({
          departmentIds: departmentIds,
          excludeUserId: session.id
        });
      } else if (session.department_id) {
        // Fallback: If no explicit assignments, use the manager's own department
        console.log(`Using manager's own department: ${session.department_id}`);
        employees = await getUsers({
          departmentIds: [session.department_id],
          excludeUserId: session.id
        });
      } else {
        // Fallback: empty array if no department assigned
        console.log('Manager has no department assigned');
        employees = [];
      }
    } else if (session.role === 'employee') {
      // Employees should use the dedicated employee dashboard API
      return NextResponse.json({
        error: 'Employees should use the dedicated employee dashboard API'
      }, { status: 403 });
    } else {
      // Fallback: empty array for unknown roles
      employees = [];
    }

    console.log(`Fetched ${employees.length} employees for ${session.role} user`);

    // --- Fetch Today's Logs Count ---
    const todayLogsCount = await getAttendanceLogsCount(today);

    // --- Fetch Today's Logs ---
    const todayLogs = await getAttendanceLogs({
      date: today,
      orderDirection: 'asc'
    });

    // --- Fetch Recent Logs ---
    const recentLogs = await getAttendanceLogs({
      limit: 20,
      orderDirection: 'desc'
    });

    // --- Fetch Adherence Records ---
    const adherenceRecords = await getAdherenceRecords(today);

    // Create a map of user IDs to adherence status
    const userAdherenceMap = new Map();
    adherenceRecords.forEach(record => {
      userAdherenceMap.set(record.user_id, record);
    });

    // --- Process Employee Status ---
    let employeeStatuses = [];
    let activeEmployeeCount = 0;

    if (employees.length > 0) {
      try {
        // Group logs by user ID for efficient lookup
        const logsByUser = {};
        todayLogs.forEach(log => {
          if (!logsByUser[log.user_id]) {
            logsByUser[log.user_id] = [];
          }
          logsByUser[log.user_id].push(log);
        });

        // Calculate metrics for each employee
        const userMetricsMap = new Map();

        // For employees without adherence records, calculate it
        const supabase = await createClient();

        for (const employee of employees) {
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
        employeeStatuses = employees.map(employee => {
          const metrics = userMetricsMap.get(employee.id);
          const adherence = userAdherenceMap.get(employee.id);
          const department = departmentMap[employee.department_id] || departmentMap['unassigned'];

          // Use our utility to determine adherence status if not already set
          let adherenceStatus = adherence?.status;
          if (!adherenceStatus && metrics) {
            adherenceStatus = determineAdherenceStatus(
              employee,
              department,
              metrics,
              today,
              logsByUser[employee.id] || [],
              timezone
            );
          }

          // Check absent eligibility
          let eligibleForAbsent = adherence?.eligible_for_absent || false;
          if (adherenceStatus === 'late' && !eligibleForAbsent) {
            eligibleForAbsent = checkAbsentEligibility(adherenceStatus, today);
          }

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
                formatTimestamp(metrics.lastActivity.timestamp, timezone) : '',
              department_id: employee.department_id || 'unassigned',
              totalActiveTime: metrics.workTime, // Keep as seconds to match client-side
              totalBreakTime: metrics.breakTime,  // Keep as seconds to match client-side
              adherence: adherenceStatus,
              eligible_for_absent: eligibleForAbsent
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
              adherence: adherenceStatus,
              eligible_for_absent: eligibleForAbsent
            };
          }
        });

        // Count active employees
        activeEmployeeCount = employeeStatuses.filter(emp => emp.status !== 'signed_out').length;
      } catch (error) {
        console.error('Error processing employee metrics:', error);

        // Fallback: Create basic employee status objects without metrics
        employeeStatuses = employees.map(employee => ({
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

    // Sort employee statuses: active first, then by name
    employeeStatuses.sort((a, b) => {
      // Active employees first
      if (a.status !== 'signed_out' && b.status === 'signed_out') return -1;
      if (a.status === 'signed_out' && b.status !== 'signed_out') return 1;

      // Then sort by name
      return a.name.localeCompare(b.name);
    });

    // Group employees by department
    const employeesByDepartmentObj = {
      'unassigned': []
    };

    // Initialize with all departments
    departments.forEach(dept => {
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

    // Get the department name for the current user if they're a manager
    let userDepartmentName = 'All Departments';
    if (session.role === 'manager' && session.department_id) {
      const dept = departmentMap[session.department_id];
      if (dept && dept.name) {
        userDepartmentName = dept.name;
      }
    }

    // Return the dashboard data
    return NextResponse.json({
      employeeStatuses,
      employeesByDepartment: employeesByDepartmentObj,
      allEmployees: employees,
      activeEmployeeCount,
      todayLogsCount,
      departmentMap,
      recentLogs,
      today,
      timezone,
      userRole: session.role,
      userDepartmentId: session.department_id,
      userDepartmentName,
      userId: session.id
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
