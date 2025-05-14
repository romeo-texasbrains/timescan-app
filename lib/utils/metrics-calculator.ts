import { formatInTimeZone } from 'date-fns-tz';
import { startOfDay } from 'date-fns';
import { capShiftDuration } from '@/lib/shift-utils';
import { determineUserStatus, getLastActivity } from '@/lib/utils/statusDetermination';
import { Database } from '@/lib/supabase/database.types';

type AttendanceLog = Database['public']['Tables']['attendance_logs']['Row'];

interface TimePeriod {
  start: Date;
  end: Date;
}

export interface AttendanceMetrics {
  userId: string;
  workTime: number; // in seconds
  breakTime: number; // in seconds
  overtimeSeconds: number;
  isActive: boolean;
  isOnBreak: boolean;
  lastActivity: {
    type: 'signin' | 'signout' | 'break_start' | 'break_end';
    timestamp: string;
  } | null;
  weekTime: number; // in seconds
  monthTime: number; // in seconds
}

/**
 * Calculate attendance metrics for a single user
 */
export function calculateUserAttendanceMetrics(
  logs: AttendanceLog[],
  timezone: string,
  userId: string
): AttendanceMetrics {
  // Current time in the specified timezone
  const now = new Date();
  const nowInTimezone = new Date(formatInTimeZone(now, timezone, 'yyyy-MM-dd HH:mm:ss'));

  // Time period boundaries
  const todayStart = startOfDay(nowInTimezone);
  const todayDateStr = formatInTimeZone(todayStart, timezone, 'yyyy-MM-dd');

  console.log(`Filtering logs for today: ${todayDateStr}`);

  // IMPORTANT: Filter logs to only include today's logs before processing
  const todayLogs = logs.filter(log => {
    if (!log.timestamp) return false;
    const logDate = new Date(log.timestamp);
    const logDateStr = formatInTimeZone(logDate, timezone, 'yyyy-MM-dd');
    const isToday = logDateStr === todayDateStr;

    if (isToday) {
      console.log(`Including log: ${log.event_type} at ${formatInTimeZone(logDate, timezone, 'HH:mm:ss')}`);
    }

    return isToday;
  });

  console.log(`Filtered ${logs.length} total logs to ${todayLogs.length} logs for today (${todayDateStr})`);

  // Sort logs chronologically
  const sortedLogs = [...todayLogs].sort(
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

  // Calculate week and month start dates
  const weekStart = new Date(nowInTimezone);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
  weekStart.setHours(0, 0, 0, 0);

  const monthStart = new Date(nowInTimezone);
  monthStart.setDate(1); // Start of month
  monthStart.setHours(0, 0, 0, 0);

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

  // Since we already filtered logs to only include today's logs,
  // all active periods should be for today
  console.log(`Active periods: ${activePeriods.length}`);

  // Log each period for debugging
  activePeriods.forEach((period, index) => {
    console.log(`Period ${index+1}: ${formatInTimeZone(period.start, timezone, 'yyyy-MM-dd HH:mm:ss')} to ${formatInTimeZone(period.end, timezone, 'yyyy-MM-dd HH:mm:ss')}`);
  });

  // Calculate today's work time in seconds
  let workTime = calculateTotalSeconds(activePeriods);

  // Hard cap on work time - no more than 24 hours (86400 seconds)
  const MAX_REASONABLE_WORK_HOURS = 24;
  const MAX_REASONABLE_WORK_SECONDS = MAX_REASONABLE_WORK_HOURS * 3600;

  if (workTime > MAX_REASONABLE_WORK_SECONDS) {
    console.warn(`Unreasonable work time detected: ${Math.floor(workTime/3600)}h. Capping to ${MAX_REASONABLE_WORK_HOURS}h.`);
    workTime = MAX_REASONABLE_WORK_SECONDS;
  }

  // Log each break period for debugging
  console.log(`Break periods: ${breakPeriods.length}`);
  breakPeriods.forEach((period, index) => {
    console.log(`Break Period ${index+1}: ${formatInTimeZone(period.start, timezone, 'yyyy-MM-dd HH:mm:ss')} to ${formatInTimeZone(period.end, timezone, 'yyyy-MM-dd HH:mm:ss')}`);
  });

  // Calculate break time
  let breakTime = calculateTotalSeconds(breakPeriods);

  // Hard cap on break time - no more than 8 hours (28800 seconds)
  const MAX_REASONABLE_BREAK_HOURS = 8;
  const MAX_REASONABLE_BREAK_SECONDS = MAX_REASONABLE_BREAK_HOURS * 3600;

  if (breakTime > MAX_REASONABLE_BREAK_SECONDS) {
    console.warn(`Unreasonable break time detected: ${Math.floor(breakTime/3600)}h. Capping to ${MAX_REASONABLE_BREAK_HOURS}h.`);
    breakTime = MAX_REASONABLE_BREAK_SECONDS;
  }

  // Calculate overtime (anything over 8 hours)
  const standardWorkdaySecs = 8 * 3600; // 8 hours in seconds
  const overtimeSeconds = Math.max(0, workTime - standardWorkdaySecs);

  // Log overtime calculation
  console.log(`Overtime calculation: workTime=${workTime}s, standardWorkday=${standardWorkdaySecs}s, overtime=${overtimeSeconds}s`);

  // Sanity check - if overtime is unreasonably high, cap it
  const MAX_REASONABLE_OVERTIME_HOURS = 16; // Maximum reasonable overtime (16 hours)
  const MAX_REASONABLE_OVERTIME_SECONDS = MAX_REASONABLE_OVERTIME_HOURS * 3600;

  let finalOvertimeSeconds = overtimeSeconds;
  if (overtimeSeconds > MAX_REASONABLE_OVERTIME_SECONDS) {
    console.warn(`Unreasonable overtime detected: ${Math.floor(overtimeSeconds/3600)}h. Capping to ${MAX_REASONABLE_OVERTIME_HOURS}h.`);
    finalOvertimeSeconds = MAX_REASONABLE_OVERTIME_SECONDS;
  }

  // Calculate week and month times
  const weekTime = calculateTimeInPeriod(activePeriods, weekStart);
  const monthTime = calculateTimeInPeriod(activePeriods, monthStart);

  // Debug log with more details
  console.log(`Metrics for user ${userId}:
    Today: ${formatInTimeZone(todayStart, timezone, 'yyyy-MM-dd')}
    workTime=${workTime}s (${Math.floor(workTime/3600)}h ${Math.floor((workTime%3600)/60)}m)
    breakTime=${breakTime}s (${Math.floor(breakTime/3600)}h ${Math.floor((breakTime%3600)/60)}m)
    overtimeSeconds=${overtimeSeconds}s (${Math.floor(overtimeSeconds/3600)}h ${Math.floor((overtimeSeconds%3600)/60)}m)
    isActive=${isActive}, isOnBreak=${isOnBreak}
    weekTime=${weekTime}s, monthTime=${monthTime}s
  `);

  // Final metrics object with validated values
  const metricsResult = {
    userId,
    workTime,
    breakTime,
    overtimeSeconds: finalOvertimeSeconds,
    isActive,
    isOnBreak,
    lastActivity,
    weekTime,
    monthTime
  };

  // Log the final metrics for debugging
  console.log(`Final metrics for user ${userId}:
    workTime=${metricsResult.workTime}s (${Math.floor(metricsResult.workTime/3600)}h ${Math.floor((metricsResult.workTime%3600)/60)}m)
    breakTime=${metricsResult.breakTime}s (${Math.floor(metricsResult.breakTime/3600)}h ${Math.floor((metricsResult.breakTime%3600)/60)}m)
    overtimeSeconds=${metricsResult.overtimeSeconds}s (${Math.floor(metricsResult.overtimeSeconds/3600)}h ${Math.floor((metricsResult.overtimeSeconds%3600)/60)}m)
    weekTime=${metricsResult.weekTime}s (${Math.floor(metricsResult.weekTime/3600)}h ${Math.floor((metricsResult.weekTime%3600)/60)}m)
    monthTime=${metricsResult.monthTime}s (${Math.floor(metricsResult.monthTime/3600)}h ${Math.floor((metricsResult.monthTime%3600)/60)}m)
  `);

  return metricsResult;
}

/**
 * Calculate total seconds from an array of time periods
 */
export function calculateTotalSeconds(periods: TimePeriod[]): number {
  return periods.reduce((total, period) => {
    const startTime = period.start.getTime();
    const endTime = period.end.getTime();

    if (endTime <= startTime) return total;

    // Apply capping to prevent unreasonably long durations
    const { durationSeconds } = capShiftDuration(startTime, endTime);

    return total + durationSeconds;
  }, 0);
}

/**
 * Calculate time within a specific period (e.g., week or month)
 */
export function calculateTimeInPeriod(periods: TimePeriod[], periodStart: Date): number {
  return periods.reduce((total, period) => {
    // Skip if period is entirely before the start date
    if (period.end < periodStart) return total;

    const startTime = Math.max(period.start.getTime(), periodStart.getTime());
    const endTime = period.end.getTime();

    if (endTime <= startTime) return total;

    // Apply capping to prevent unreasonably long durations
    const { durationSeconds } = capShiftDuration(startTime, endTime);

    return total + durationSeconds;
  }, 0);
}
