import { NextRequest, NextResponse } from 'next/server';
import { format } from 'date-fns';
import { getAuthenticatedUser } from '@/lib/auth/session';
import { 
  getUsers, 
  getDepartments, 
  getAttendanceLogs, 
  getAttendanceLogsCount,
  getAdherenceRecords,
  getAppSettings
} from '@/lib/db/queries';
import { calculateUserAttendanceMetrics } from '@/lib/utils/metrics-calculator';
import { determineAdherenceStatus, checkAbsentEligibility } from '@/lib/utils/adherence-calculator';
import { formatTimestamp } from '@/lib/utils/time-formatter';
import { createClient } from '@/lib/supabase/server';

/**
 * GET handler for the employee dashboard data API
 * Returns dashboard data for the authenticated employee
 */
export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user
    const session = await getAuthenticatedUser();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get today's date in ISO format for filtering
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    
    // --- Fetch App Settings (Timezone) ---
    const settings = await getAppSettings();
    const timezone = settings.timezone || 'UTC';
    
    // --- Fetch User's Department ---
    let department = null;
    if (session.department_id) {
      const departments = await getDepartments({ departmentId: session.department_id });
      if (departments.length > 0) {
        department = departments[0];
      }
    }
    
    // Create department info
    const departmentInfo = department ? {
      id: department.id,
      name: department.name,
      shift_start_time: department.shift_start_time || '09:00:00',
      shift_end_time: department.shift_end_time || '17:00:00',
      grace_period_minutes: department.grace_period_minutes || 30
    } : {
      id: 'unassigned',
      name: 'Unassigned',
      shift_start_time: '09:00:00',
      shift_end_time: '17:00:00',
      grace_period_minutes: 30
    };
    
    // --- Fetch User Profile ---
    const userProfiles = await getUsers({ userId: session.id });
    if (userProfiles.length === 0) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }
    
    const userProfile = userProfiles[0];
    
    // --- Fetch Today's Logs for the User ---
    const todayLogs = await getAttendanceLogs({
      date: today,
      userId: session.id,
      orderDirection: 'asc'
    });
    
    // --- Fetch Recent Logs for the User ---
    const recentLogs = await getAttendanceLogs({
      userId: session.id,
      limit: 20,
      orderDirection: 'desc'
    });
    
    // --- Fetch User's Adherence Record ---
    const adherenceRecords = await getAdherenceRecords(today, session.id);
    let adherenceRecord = adherenceRecords.length > 0 ? adherenceRecords[0] : null;
    
    // --- Process User Status ---
    let userStatus = null;
    let activeTime = 0;
    let breakTime = 0;
    let adherenceStatus = adherenceRecord?.status || null;
    let eligibleForAbsent = false;
    
    try {
      // Calculate metrics for the user
      const metrics = calculateUserAttendanceMetrics(todayLogs, timezone, session.id);
      
      // If no adherence record exists, calculate it
      if (!adherenceRecord) {
        const supabase = await createClient();
        try {
          const { data: calculatedStatus, error: calcError } = await supabase
            .rpc('calculate_adherence_status', {
              p_user_id: session.id,
              p_date: todayStr
            });
          
          if (calcError) {
            console.error(`Error calculating adherence for ${session.id}:`, calcError);
          } else if (calculatedStatus) {
            adherenceStatus = calculatedStatus;
          }
        } catch (error) {
          console.error(`Error calculating adherence for ${session.id}:`, error);
        }
      }
      
      // Use our utility to determine adherence status if not already set
      if (!adherenceStatus) {
        adherenceStatus = determineAdherenceStatus(
          userProfile,
          departmentInfo,
          metrics,
          today,
          todayLogs,
          timezone
        );
      }
      
      // Check absent eligibility
      if (adherenceStatus === 'late') {
        if (adherenceRecord?.eligible_for_absent !== undefined) {
          eligibleForAbsent = adherenceRecord.eligible_for_absent;
        } else {
          eligibleForAbsent = checkAbsentEligibility(adherenceStatus, today);
        }
      }
      
      // Create user status object
      userStatus = {
        id: session.id,
        name: userProfile.full_name || 'Unnamed',
        status: metrics.isOnBreak ? 'on_break' : metrics.isActive ? 'signed_in' : 'signed_out',
        lastActivity: metrics.lastActivity ?
          (metrics.lastActivity.type === 'break_start' ? 'On Break' :
           metrics.lastActivity.type === 'signin' ? 'Signed In' :
           metrics.lastActivity.type === 'break_end' ? 'Signed In' : 'Signed Out')
          : 'No activity recorded',
        lastActivityTime: metrics.lastActivity ?
          formatTimestamp(metrics.lastActivity.timestamp, timezone) : '',
        department_id: userProfile.department_id || 'unassigned',
        totalActiveTime: metrics.workTime,
        totalBreakTime: metrics.breakTime,
        adherence: adherenceStatus,
        eligible_for_absent: eligibleForAbsent
      };
      
      activeTime = metrics.workTime;
      breakTime = metrics.breakTime;
    } catch (error) {
      console.error('Error processing user metrics:', error);
      
      // Fallback: Create basic user status object without metrics
      userStatus = {
        id: session.id,
        name: userProfile.full_name || 'Unnamed',
        status: 'signed_out',
        lastActivity: 'No activity recorded',
        lastActivityTime: '',
        department_id: userProfile.department_id || 'unassigned',
        totalActiveTime: 0,
        totalBreakTime: 0,
        adherence: adherenceStatus,
        eligible_for_absent: eligibleForAbsent
      };
    }
    
    // --- Fetch Weekly Stats (Last 7 Days) ---
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6); // Last 7 days including today
    
    const weeklyLogs = await getAttendanceLogs({
      dateRange: { start: weekStart, end: today },
      userId: session.id,
      orderDirection: 'asc'
    });
    
    // Group logs by day
    const logsByDay = {};
    weeklyLogs.forEach(log => {
      const day = format(new Date(log.timestamp), 'yyyy-MM-dd');
      if (!logsByDay[day]) {
        logsByDay[day] = [];
      }
      logsByDay[day].push(log);
    });
    
    // Calculate metrics for each day
    const dailyStats = [];
    let currentDate = new Date(weekStart);
    
    while (currentDate <= today) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      const dayLogs = logsByDay[dateStr] || [];
      
      const dayMetrics = calculateUserAttendanceMetrics(dayLogs, timezone, session.id);
      
      dailyStats.push({
        date: dateStr,
        activeTime: dayMetrics.workTime,
        breakTime: dayMetrics.breakTime,
        dayOfWeek: format(currentDate, 'EEE')
      });
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Return the dashboard data
    return NextResponse.json({
      userStatus,
      activeTime,
      breakTime,
      recentLogs,
      dailyStats,
      department: departmentInfo,
      today,
      timezone
    });
    
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
