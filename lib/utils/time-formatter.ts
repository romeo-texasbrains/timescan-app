import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

/**
 * Formats a duration in seconds to a human-readable string
 * @param seconds The duration in seconds
 * @returns Formatted string like "2h 30m" or "45m"
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/**
 * Formats a timestamp with the specified timezone
 * @param timestamp ISO timestamp string or Date object
 * @param timezone Timezone string (e.g., 'America/New_York')
 * @param formatString Format string for date-fns
 * @returns Formatted date/time string
 */
export function formatTimestamp(
  timestamp: string | Date,
  timezone: string = 'UTC',
  formatString: string = 'h:mm a'
): string {
  if (!timestamp) return '';
  
  try {
    const date = typeof timestamp === 'string' ? parseISO(timestamp) : timestamp;
    return formatInTimeZone(date, timezone, formatString);
  } catch (error) {
    console.error('Error formatting timestamp:', error);
    return '';
  }
}

/**
 * Formats a date to YYYY-MM-DD format
 * @param date Date object
 * @returns Formatted date string
 */
export function formatDateToYYYYMMDD(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Caps a shift duration to prevent unreasonably long durations
 * @param startTime Start time in milliseconds
 * @param endTime End time in milliseconds
 * @param maxHours Maximum allowed hours (default: 12)
 * @returns Object with capped duration in milliseconds and seconds
 */
export function capShiftDuration(
  startTime: number,
  endTime: number,
  maxHours: number = 12
): { durationMs: number; durationSeconds: number } {
  const maxDurationMs = maxHours * 60 * 60 * 1000;
  const actualDurationMs = endTime - startTime;
  
  // Cap the duration if it exceeds the maximum
  const cappedDurationMs = Math.min(actualDurationMs, maxDurationMs);
  const durationSeconds = Math.floor(cappedDurationMs / 1000);
  
  return { durationMs: cappedDurationMs, durationSeconds };
}
