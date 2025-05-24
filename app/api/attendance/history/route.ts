import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth/session';
import {
  getUsers,
  getAttendanceLogs,
  getManagerAssignedDepartments,
  getAppSettings
} from '@/lib/db/queries';
import { calculateUserAttendanceMetrics } from '@/lib/utils/metrics-calculator';
import { formatTimestamp, formatDateToYYYYMMDD } from '@/lib/utils/time-formatter';
import { getSearchParams, getQueryParam, getQueryParamAsBoolean } from '@/lib/utils/api-helpers';
import { parse, isValid, parseISO, format } from 'date-fns';

/**
 * GET handler for the attendance history API
 * Returns attendance history based on the user's role and query parameters
 */
export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user
    const session = await getAuthenticatedUser();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters using helper function
    const searchParams = getSearchParams(request, 'http://localhost:3000/api/attendance/history');

    const startDateParam = getQueryParam(searchParams, 'startDate');
    const endDateParam = getQueryParam(searchParams, 'endDate');
    const targetUserIdParam = getQueryParam(searchParams, 'userId');
    const includeMetricsParam = getQueryParamAsBoolean(searchParams, 'includeMetrics', true);
    const groupByDayParam = getQueryParamAsBoolean(searchParams, 'groupByDay', false);

    // Validate date parameters
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (startDateParam) {
      startDate = parseISO(startDateParam);
      if (!isValid(startDate)) {
        return NextResponse.json({ error: 'Invalid startDate format. Use YYYY-MM-DD.' }, { status: 400 });
      }
    } else {
      // Default to 7 days ago if not provided
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
    }

    if (endDateParam) {
      endDate = parseISO(endDateParam);
      if (!isValid(endDate)) {
        return NextResponse.json({ error: 'Invalid endDate format. Use YYYY-MM-DD.' }, { status: 400 });
      }
    } else {
      // Default to today if not provided
      endDate = new Date();
    }

    // Ensure startDate is before endDate
    if (startDate > endDate) {
      return NextResponse.json({ error: 'startDate must be before endDate' }, { status: 400 });
    }

    // Determine target user ID based on role and parameters
    let targetUserId: string | null = null;
    let targetUserIds: string[] = [];

    if (targetUserIdParam) {
      // If a specific user ID is requested, check authorization
      if (session.role === 'employee' && targetUserIdParam !== session.id) {
        // Employees can only view their own history
        return NextResponse.json({
          error: 'Unauthorized: Employees can only view their own attendance history'
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
              error: 'Unauthorized: Managers can only view attendance history for users in their departments'
            }, { status: 403 });
          }
        } else {
          // Manager has no departments, can only view their own history
          if (targetUserIdParam !== session.id) {
            return NextResponse.json({
              error: 'Unauthorized: You are not assigned to any departments'
            }, { status: 403 });
          }
        }
      }

      // If we reach here, the user is authorized to view the requested history
      targetUserId = targetUserIdParam;
      targetUserIds = [targetUserIdParam];
    } else {
      // No specific user requested, determine what to return based on role
      if (session.role === 'employee') {
        // Employees only see their own history
        targetUserId = session.id;
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
          // Manager has no departments, only show their own history
          targetUserIds = [session.id];
        }
      } else if (session.role === 'admin') {
        // Admins can see all users, but we'll limit to a reasonable number
        // For bulk requests, it's better to use specific filters
        const users = await getUsers({});
        targetUserIds = users.map(user => user.id);

        // If there are too many users, return an error and suggest filtering
        if (targetUserIds.length > 50) {
          return NextResponse.json({
            error: 'Too many users. Please specify a userId or use department filters.'
          }, { status: 400 });
        }
      }
    }

    // Get app settings for timezone
    const settings = await getAppSettings();
    const timezone = settings.timezone || 'UTC';

    // Fetch attendance logs
    let attendanceLogs = [];

    if (targetUserId) {
      // Fetch logs for a specific user
      attendanceLogs = await getAttendanceLogs({
        userId: targetUserId,
        dateRange: { start: startDate, end: endDate },
        orderDirection: 'asc'
      });
    } else if (targetUserIds.length > 0) {
      // Fetch logs for multiple users
      // Since our getAttendanceLogs doesn't support multiple userIds directly,
      // we'll fetch them one by one and combine
      for (const userId of targetUserIds) {
        const userLogs = await getAttendanceLogs({
          userId,
          dateRange: { start: startDate, end: endDate },
          orderDirection: 'asc'
        });

        attendanceLogs = [...attendanceLogs, ...userLogs];
      }

      // Sort combined logs by timestamp
      attendanceLogs.sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    }

    // Process logs based on query parameters
    let result: any = {};

    if (groupByDayParam) {
      // Group logs by day and user
      const logsByDayAndUser: Record<string, Record<string, any[]>> = {};

      attendanceLogs.forEach(log => {
        const day = format(new Date(log.timestamp), 'yyyy-MM-dd');
        const userId = log.user_id;

        if (!logsByDayAndUser[day]) {
          logsByDayAndUser[day] = {};
        }

        if (!logsByDayAndUser[day][userId]) {
          logsByDayAndUser[day][userId] = [];
        }

        logsByDayAndUser[day][userId].push(log);
      });

      // Calculate metrics for each day and user if requested
      const dailyMetrics: Record<string, any[]> = {};

      for (const day in logsByDayAndUser) {
        dailyMetrics[day] = [];

        for (const userId in logsByDayAndUser[day]) {
          const userLogs = logsByDayAndUser[day][userId];

          if (includeMetricsParam) {
            // Calculate metrics for this user on this day
            const metrics = calculateUserAttendanceMetrics(userLogs, timezone, userId);

            // Get user details
            const users = await getUsers({ userId });
            const user = users.length > 0 ? users[0] : { full_name: 'Unknown User' };

            dailyMetrics[day].push({
              userId,
              userName: user.full_name,
              logs: userLogs.map(log => ({
                id: log.id,
                eventType: log.event_type,
                timestamp: log.timestamp,
                formattedTime: formatTimestamp(log.timestamp, timezone)
              })),
              metrics: {
                activeTime: metrics.workTime,
                breakTime: metrics.breakTime,
                isActive: metrics.isActive,
                isOnBreak: metrics.isOnBreak,
                lastActivity: metrics.lastActivity
              }
            });
          } else {
            // Just include the logs without metrics
            const users = await getUsers({ userId });
            const user = users.length > 0 ? users[0] : { full_name: 'Unknown User' };

            dailyMetrics[day].push({
              userId,
              userName: user.full_name,
              logs: userLogs.map(log => ({
                id: log.id,
                eventType: log.event_type,
                timestamp: log.timestamp,
                formattedTime: formatTimestamp(log.timestamp, timezone)
              }))
            });
          }
        }
      }

      result = {
        groupedByDay: dailyMetrics,
        startDate: formatDateToYYYYMMDD(startDate),
        endDate: formatDateToYYYYMMDD(endDate),
        timezone
      };
    } else {
      // Return chronological list of events
      // Fetch user details for all users in the logs
      const uniqueUserIds = [...new Set(attendanceLogs.map(log => log.user_id))];
      const userMap: Record<string, any> = {};

      for (const userId of uniqueUserIds) {
        const users = await getUsers({ userId });
        if (users.length > 0) {
          userMap[userId] = users[0];
        }
      }

      // Format logs with user details
      const formattedLogs = attendanceLogs.map(log => ({
        id: log.id,
        userId: log.user_id,
        userName: userMap[log.user_id]?.full_name || 'Unknown User',
        eventType: log.event_type,
        timestamp: log.timestamp,
        formattedTime: formatTimestamp(log.timestamp, timezone),
        formattedDate: formatTimestamp(log.timestamp, timezone, 'MMM d, yyyy')
      }));

      result = {
        logs: formattedLogs,
        startDate: formatDateToYYYYMMDD(startDate),
        endDate: formatDateToYYYYMMDD(endDate),
        timezone
      };
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
