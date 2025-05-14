/**
 * Utility functions for working with attendance adherence
 */

import { Database } from '@/lib/supabase/database.types';
import { formatInTimeZone } from 'date-fns-tz';
import { parseISO, differenceInHours } from 'date-fns';

export type AdherenceStatus = Database['public']['Enums']['adherence_status'];

/**
 * Get a human-readable label for an adherence status
 */
export function getAdherenceLabel(status: AdherenceStatus | null): string {
  switch (status) {
    case 'early': return 'Early';
    case 'on_time': return 'On Time';
    case 'late': return 'Late';
    case 'absent': return 'Absent';
    default: return 'Unknown';
  }
}

/**
 * Get a color for an adherence status badge
 */
export function getAdherenceColor(status: AdherenceStatus | null): string {
  switch (status) {
    case 'early': return 'success'; // Green
    case 'on_time': return 'success'; // Green
    case 'late': return 'warning'; // Yellow/Orange
    case 'absent': return 'destructive'; // Red
    default: return 'secondary'; // Gray
  }
}

/**
 * Check if an employee is eligible to be marked absent
 * (They are late and it's been more than 4 hours since their shift started)
 */
export function isEligibleForAbsentMarking(
  adherenceStatus: AdherenceStatus | null,
  shiftStartTime: string | null,
  currentTime: Date = new Date()
): boolean {
  // Only employees marked as 'late' can be marked absent
  if (adherenceStatus !== 'late') {
    return false;
  }

  // If no shift start time, use default (9 AM)
  if (!shiftStartTime) {
    shiftStartTime = '09:00:00';
  }

  // Parse the shift start time
  const today = new Date();
  const shiftStartDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    parseInt(shiftStartTime.split(':')[0]),
    parseInt(shiftStartTime.split(':')[1]),
    parseInt(shiftStartTime.split(':')[2] || '0')
  );

  // Check if it's been more than 4 hours since shift start
  const hoursSinceShiftStart = differenceInHours(currentTime, shiftStartDate);
  return hoursSinceShiftStart >= 4;
}

/**
 * Get a tooltip message for an adherence status
 */
export function getAdherenceTooltip(status: AdherenceStatus | null, shiftStartTime: string | null): string {
  const formattedTime = shiftStartTime 
    ? formatShiftTime(shiftStartTime)
    : '9:00 AM';

  switch (status) {
    case 'early':
      return `Arrived before the scheduled shift start time (${formattedTime})`;
    case 'on_time':
      return `Arrived on time for the scheduled shift (${formattedTime})`;
    case 'late':
      return `Arrived after the scheduled shift start time (${formattedTime})`;
    case 'absent':
      return `Marked absent for this shift (${formattedTime})`;
    default:
      return 'No attendance record for this shift';
  }
}

/**
 * Format a time string (HH:MM:SS) to a more readable format (h:mm A)
 */
export function formatShiftTime(timeStr: string): string {
  const [hours, minutes] = timeStr.split(':');
  const h = parseInt(hours);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12; // Convert 0 to 12 for 12 AM
  return `${hour}:${minutes} ${period}`;
}
