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
  // Sort logs chronologically
  const sortedLogs = [...logs].sort(
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

  // Current time in the specified timezone
  const now = new Date();
  const nowInTimezone = new Date(formatInTimeZone(now, timezone, 'yyyy-MM-dd HH:mm:ss'));

  // Time period boundaries
  const todayStart = startOfDay(nowInTimezone);
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

  // Calculate total work time in seconds
  const workTime = calculateTotalSeconds(activePeriods);

  // Calculate total break time in seconds
  const breakTime = calculateTotalSeconds(breakPeriods);

  // Calculate overtime (anything over 8 hours)
  const standardWorkdaySecs = 8 * 3600; // 8 hours in seconds
  const overtimeSeconds = Math.max(0, workTime - standardWorkdaySecs);

  // Calculate week and month times
  const weekTime = calculateTimeInPeriod(activePeriods, weekStart);
  const monthTime = calculateTimeInPeriod(activePeriods, monthStart);

  // Debug log
  console.log(`Metrics for user ${userId}: workTime=${workTime}s, breakTime=${breakTime}s, isActive=${isActive}, isOnBreak=${isOnBreak}`);

  return {
    userId,
    workTime,
    breakTime,
    overtimeSeconds,
    isActive,
    isOnBreak,
    lastActivity,
    weekTime,
    monthTime
  };
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
