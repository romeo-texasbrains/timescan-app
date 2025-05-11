/**
 * Utility functions for handling shift calculations and validations
 */

// Maximum allowed shift duration in hours
export const MAX_SHIFT_DURATION_HOURS = 16;

// Maximum allowed shift duration in seconds
export const MAX_SHIFT_DURATION_SECONDS = MAX_SHIFT_DURATION_HOURS * 3600;

/**
 * Caps a shift duration to the maximum allowed duration
 * Returns the capped duration and a flag indicating if capping was applied
 * 
 * @param startTime - Start time of the shift in milliseconds
 * @param endTime - End time of the shift in milliseconds
 * @returns Object containing the capped duration in seconds and a flag indicating if capping was applied
 */
export function capShiftDuration(startTime: number, endTime: number): { 
  durationSeconds: number; 
  wasCapped: boolean;
  originalDurationSeconds: number;
} {
  // Calculate the original duration in seconds
  const originalDurationSeconds = (endTime - startTime) / 1000;
  
  // Check if the duration exceeds the maximum allowed
  const wasCapped = originalDurationSeconds > MAX_SHIFT_DURATION_SECONDS;
  
  // Cap the duration if needed
  const durationSeconds = wasCapped 
    ? MAX_SHIFT_DURATION_SECONDS 
    : originalDurationSeconds;
  
  return { durationSeconds, wasCapped, originalDurationSeconds };
}

/**
 * Calculates the end time for a shift based on the start time and a maximum duration
 * 
 * @param startTime - Start time of the shift in milliseconds
 * @returns The maximum end time in milliseconds
 */
export function calculateMaxEndTime(startTime: number): number {
  return startTime + (MAX_SHIFT_DURATION_SECONDS * 1000);
}

/**
 * Determines if a shift is an overnight shift based on the start and end times
 * 
 * @param startDate - Start date of the shift
 * @param endDate - End date of the shift
 * @returns Boolean indicating if this is an overnight shift
 */
export function isOvernightShift(startDate: Date, endDate: Date): boolean {
  return startDate.getUTCDate() !== endDate.getUTCDate();
}

/**
 * Formats a duration in seconds to a human-readable string (e.g., "8h 30m")
 * 
 * @param seconds - Duration in seconds
 * @returns Formatted duration string
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}
