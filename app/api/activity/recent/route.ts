import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import {
  getUsers,
  getDepartments,
  getAttendanceLogs,
  getManagerAssignedDepartments,
  getAppSettings
} from '@/lib/db/queries';
import { formatTimestamp } from '@/lib/utils/time-formatter';
import { getSearchParams, getQueryParam, getQueryParamAsNumber } from '@/lib/utils/api-helpers';

/**
 * GET handler for the recent activity API
 * Returns recent activity logs based on the user's role
 */
export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user
    const session = await getAuthenticatedUser();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters using helper function
    const searchParams = getSearchParams(request, 'http://localhost:3000/api/activity/recent');

    const targetUserIdParam = getQueryParam(searchParams, 'userId');
    const departmentIdParam = getQueryParam(searchParams, 'departmentId');

    // Parse limit parameter with validation
    const limit = getQueryParamAsNumber(searchParams, 'limit', 20, 1, 100);

    // Determine target user IDs based on role and parameters
    let targetUserIds: string[] = [];

    if (targetUserIdParam) {
      // If a specific user ID is requested, check authorization
      if (session.role === 'employee' && targetUserIdParam !== session.id) {
        // Employees can only view their own activity
        return NextResponse.json({
          error: 'Unauthorized: Employees can only view their own activity'
        }, { status: 403 });
      } else if (session.role === 'manager') {
        // Managers can only view users in their departments
        const managerDepartments = await getManagerAssignedDepartments(session.id);
        const departmentIds = managerDepartments.map(dept => dept.id);

        // If manager has no departments, fall back to their own department
        if (departmentIds.length === 0 && session.department_id) {
          departmentIds.push(session.department_id);
        }

        // Check if the target user is in the manager's departments
        if (departmentIds.length > 0) {
          const users = await getUsers({ departmentIds });
          const userIds = users.map(user => user.id);

          if (!userIds.includes(targetUserIdParam)) {
            return NextResponse.json({
              error: 'Unauthorized: Managers can only view activity for users in their departments'
            }, { status: 403 });
          }
        } else {
          // Manager has no departments, can only view their own activity
          if (targetUserIdParam !== session.id) {
            return NextResponse.json({
              error: 'Unauthorized: You are not assigned to any departments'
            }, { status: 403 });
          }
        }
      }

      // If we reach here, the user is authorized to view the requested activity
      targetUserIds = [targetUserIdParam];
    } else if (departmentIdParam) {
      // If a specific department is requested
      if (session.role === 'employee') {
        // Employees can only view their own activity
        targetUserIds = [session.id];
      } else if (session.role === 'manager') {
        // Managers can only view departments they manage
        const managerDepartments = await getManagerAssignedDepartments(session.id);
        const departmentIds = managerDepartments.map(dept => dept.id);

        // If manager has no departments, fall back to their own department
        if (departmentIds.length === 0 && session.department_id) {
          departmentIds.push(session.department_id);
        }

        if (!departmentIds.includes(departmentIdParam)) {
          return NextResponse.json({
            error: 'Unauthorized: Managers can only view activity for their departments'
          }, { status: 403 });
        }

        // Get users in the requested department
        const users = await getUsers({ departmentIds: [departmentIdParam] });
        targetUserIds = users.map(user => user.id);
      } else if (session.role === 'admin') {
        // Admins can view any department
        const users = await getUsers({ departmentIds: [departmentIdParam] });
        targetUserIds = users.map(user => user.id);
      }
    } else {
      // No specific user or department requested, determine what to return based on role
      if (session.role === 'employee') {
        // Employees only see their own activity
        targetUserIds = [session.id];
      } else if (session.role === 'manager') {
        // Managers see all users in their departments
        const managerDepartments = await getManagerAssignedDepartments(session.id);
        const departmentIds = managerDepartments.map(dept => dept.id);

        // If manager has no departments, fall back to their own department
        if (departmentIds.length === 0 && session.department_id) {
          departmentIds.push(session.department_id);
        }

        if (departmentIds.length > 0) {
          const users = await getUsers({ departmentIds });
          targetUserIds = users.map(user => user.id);
        } else {
          // Manager has no departments, only show their own activity
          targetUserIds = [session.id];
        }
      } else if (session.role === 'admin') {
        // Admins can see all users
        // For recent activity, we'll fetch for all users without filtering
        targetUserIds = []; // Empty array means no user filtering
      }
    }

    // Get app settings for timezone
    const settings = await getAppSettings();
    const timezone = settings.timezone || 'UTC';

    // Fetch recent activity logs
    let recentLogs = [];

    if (targetUserIds.length > 0) {
      // Fetch logs for specific users
      recentLogs = await getAttendanceLogs({
        userIds: targetUserIds,
        limit,
        orderDirection: 'desc'
      });
    } else {
      // Fetch logs for all users (admin view)
      recentLogs = await getAttendanceLogs({
        limit,
        orderDirection: 'desc'
      });
    }

    // Fetch user details for all users in the logs
    const uniqueUserIds = [...new Set(recentLogs.map(log => log.user_id))];
    const userMap: Record<string, any> = {};

    for (const userId of uniqueUserIds) {
      const users = await getUsers({ userId });
      if (users.length > 0) {
        userMap[userId] = users[0];
      }
    }

    // Format logs with user details
    const formattedLogs = recentLogs.map(log => ({
      id: log.id,
      userId: log.user_id,
      userName: userMap[log.user_id]?.full_name || 'Unknown User',
      departmentId: userMap[log.user_id]?.department_id || null,
      departmentName: null, // Will be populated later if needed
      eventType: log.event_type,
      timestamp: log.timestamp,
      formattedTime: formatTimestamp(log.timestamp, timezone),
      formattedDate: formatTimestamp(log.timestamp, timezone, 'MMM d, yyyy')
    }));

    // If department names are needed, fetch them
    if (formattedLogs.some(log => log.departmentId)) {
      const departmentIds = [...new Set(formattedLogs.filter(log => log.departmentId).map(log => log.departmentId))];

      for (const deptId of departmentIds) {
        const departments = await getDepartments({ departmentId: deptId });
        if (departments.length > 0) {
          // Update all logs with this department ID
          formattedLogs.forEach(log => {
            if (log.departmentId === deptId) {
              log.departmentName = departments[0].name;
            }
          });
        }
      }
    }

    return NextResponse.json({
      logs: formattedLogs,
      timezone
    });

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
