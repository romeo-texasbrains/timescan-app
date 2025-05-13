/**
 * Shared utility functions for calculating attendance metrics
 * Used by both employee and admin/manager dashboards to ensure consistent calculations
 */

import { formatInTimeZone } from 'date-fns-tz';
import { startOfDay, parseISO } from 'date-fns';
import { Database } from '@/lib/supabase/database.types';
import { capShiftDuration, MAX_SHIFT_DURATION_SECONDS } from '@/lib/shift-utils';

type AttendanceLog = Database['public']['Tables']['attendance_logs']['Row'];

interface TimePeriod {
  start: Date;
  end: Date;
}

interface EmployeeTimeData {
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
}

/**
 * Calculate attendance metrics for a single user
 * 
 * @param logs - Array of attendance logs for the user
 * @param timezone - IANA timezone string (e.g., 'America/New_York')
 * @param userId - User ID
 * @returns Object containing calculated time metrics
 */
export function calculateUserAttendanceMetrics(
  logs: AttendanceLog[],
  timezone: string,
  userId: string
): EmployeeTimeData {
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
  let lastActivity = null;

  // Current time in the specified timezone
  const now = new Date();
  const nowInTimezone = new Date(formatInTimeZone(now, timezone, 'yyyy-MM-dd HH:mm:ss'));

  // Process logs to identify active and break periods
  for (const log of sortedLogs) {
    if (!log.timestamp) continue;
    
    const timestamp = new Date(log.timestamp);
    const timestampInTimezone = new Date(formatInTimeZone(timestamp, timezone, 'yyyy-MM-dd HH:mm:ss'));
    
    // Update last activity
    lastActivity = {
      type: log.event_type as any,
      timestamp: log.timestamp
    };

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

  return {
    userId,
    workTime,
    breakTime,
    overtimeSeconds,
    isActive,
    isOnBreak,
    lastActivity
  };
}

/**
 * Calculate total seconds from an array of time periods
 * 
 * @param periods - Array of time periods with start and end dates
 * @returns Total duration in seconds
 */
function calculateTotalSeconds(periods: TimePeriod[]): number {
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
 * Format seconds into a human-readable string (e.g., "2h 30m")
 * 
 * @param seconds - Duration in seconds
 * @returns Formatted duration string
 */
export function formatDurationFromSeconds(seconds: number): string {
  if (seconds < 0) seconds = 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours === 0) {
    return `${minutes}m`;
  }
  
  return `${hours}h ${minutes}m`;
}
