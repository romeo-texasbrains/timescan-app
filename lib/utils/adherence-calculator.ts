import { parseISO, isBefore, isAfter, addMinutes } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

export type AdherenceStatus = 'early' | 'on_time' | 'late' | 'absent' | null;

export type UserMetrics = {
  isActive: boolean;
  isOnBreak: boolean;
  workTime: number;
  breakTime: number;
  lastActivity?: {
    type: string;
    timestamp: string;
  };
};

/**
 * Determines the adherence status of a user based on their attendance and shift schedule
 * @param user The user object with id and other properties
 * @param department The department object with shift times and grace period
 * @param userMetrics The calculated metrics for the user
 * @param currentTime The current time to use for calculations
 * @param userLogs The attendance logs for the user
 * @returns The adherence status: 'early', 'on_time', 'late', 'absent', or null
 */
export function determineAdherenceStatus(
  user: { id: string; is_manually_absent?: boolean },
  department: { 
    shift_start_time?: string | null; 
    shift_end_time?: string | null;
    grace_period_minutes?: number | null;
  } | null,
  userMetrics: UserMetrics,
  currentTime: Date,
  userLogs: any[],
  timezone: string = 'UTC'
): AdherenceStatus {
  // If user is manually marked as absent, that takes priority
  if (user.is_manually_absent) {
    return 'absent';
  }

  // If department has no defined shifts, adherence might be "Not set"
  if (!department?.shift_start_time || !department?.shift_end_time) {
    return null;
  }

  // If user is currently active or on break, they're present
  if (userMetrics.isActive) {
    return 'on_time'; // Active users are considered on time
  }

  if (userMetrics.isOnBreak) {
    return 'on_time'; // Users on break are considered on time
  }

  // Parse shift times
  const shiftStartParts = department.shift_start_time.split(':');
  const shiftEndParts = department.shift_end_time.split(':');
  
  // Create today's date with the shift times in the correct timezone
  const today = new Date();
  const todayStr = formatInTimeZone(today, timezone, 'yyyy-MM-dd');
  
  // Create shift start and end times for today
  const shiftStartTime = toZonedTime(
    new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      parseInt(shiftStartParts[0]),
      parseInt(shiftStartParts[1]),
      parseInt(shiftStartParts[2] || '0')
    ),
    timezone
  );
  
  // Handle overnight shifts (end time is earlier than start time)
  let shiftEndTime = toZonedTime(
    new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      parseInt(shiftEndParts[0]),
      parseInt(shiftEndParts[1]),
      parseInt(shiftEndParts[2] || '0')
    ),
    timezone
  );
  
  // If end time is earlier than start time, it's an overnight shift
  if (shiftEndTime < shiftStartTime) {
    // Add a day to the end time
    shiftEndTime = new Date(shiftEndTime.getTime() + 24 * 60 * 60 * 1000);
  }
  
  // Add grace period to shift start time
  const gracePeriodMinutes = department.grace_period_minutes || 30;
  const graceEndTime = addMinutes(shiftStartTime, gracePeriodMinutes);
  
  // Convert current time to the correct timezone
  const zonedCurrentTime = toZonedTime(currentTime, timezone);
  
  // Check if user has clocked in today
  const hasClockInToday = userLogs.some(log => 
    log.event_type === 'signin' && 
    formatInTimeZone(parseISO(log.timestamp), timezone, 'yyyy-MM-dd') === todayStr
  );

  // If user has clocked in today but is currently inactive (clocked out for good)
  if (hasClockInToday && !userMetrics.isActive && !userMetrics.isOnBreak) {
    return 'on_time'; // They were present today
  }

  // If current time is before shift start, they're not late yet
  if (isBefore(zonedCurrentTime, shiftStartTime)) {
    return 'pending'; // Not yet time for their shift
  }

  // If current time is after shift start but within grace period
  if (isAfter(zonedCurrentTime, shiftStartTime) && isBefore(zonedCurrentTime, graceEndTime)) {
    if (!hasClockInToday) {
      return 'pending'; // Still within grace period
    }
  }

  // If current time is after grace period end and they haven't clocked in
  if (isAfter(zonedCurrentTime, graceEndTime) && !hasClockInToday) {
    // Check if it's been long enough to be considered absent (e.g., 4+ hours late)
    const absentThresholdHours = 4;
    const absentThresholdTime = addMinutes(shiftStartTime, absentThresholdHours * 60);
    
    if (isAfter(zonedCurrentTime, absentThresholdTime)) {
      return 'absent'; // Absent after threshold
    }
    
    return 'late'; // Late but not absent
  }

  // If they clocked in early (before shift start)
  const earliestClockIn = userLogs
    .filter(log => log.event_type === 'signin')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];
  
  if (earliestClockIn) {
    const clockInTime = toZonedTime(parseISO(earliestClockIn.timestamp), timezone);
    
    // If they clocked in more than 15 minutes early
    if (isBefore(clockInTime, new Date(shiftStartTime.getTime() - 15 * 60 * 1000))) {
      return 'early';
    }
    
    // If they clocked in up to 15 minutes early or on time
    return 'on_time';
  }

  // Default case
  return null;
}

/**
 * Checks if a user is eligible to be marked as absent
 * @param adherenceStatus The current adherence status
 * @param currentTime The current time
 * @returns Whether the user is eligible to be marked as absent
 */
export function checkAbsentEligibility(
  adherenceStatus: AdherenceStatus,
  currentTime: Date
): boolean {
  // Only users marked as 'late' can be marked absent
  if (adherenceStatus !== 'late') {
    return false;
  }
  
  // Check if it's after noon (12 PM)
  return currentTime.getHours() >= 12;
}
