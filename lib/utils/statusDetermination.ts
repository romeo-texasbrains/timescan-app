/**
 * Utility functions for determining user status from attendance logs
 */

import { Database } from '@/lib/supabase/database.types';

type AttendanceLog = Database['public']['Tables']['attendance_logs']['Row'];
type AttendanceEventType = 'signin' | 'signout' | 'break_start' | 'break_end';

export type UserStatus = 'signed_in' | 'signed_out' | 'on_break';

/**
 * Determines a user's current status based on their attendance logs
 * 
 * @param logs Array of attendance logs sorted by timestamp (ascending)
 * @returns The user's current status
 */
export function determineUserStatus(logs: AttendanceLog[]): UserStatus {
  if (!logs || logs.length === 0) {
    return 'signed_out';
  }

  // Sort logs by timestamp to ensure correct order
  const sortedLogs = [...logs].sort(
    (a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
  );

  // Process logs to determine current status
  let currentStatus: UserStatus = 'signed_out';

  for (const log of sortedLogs) {
    switch (log.event_type as AttendanceEventType) {
      case 'signin':
        currentStatus = 'signed_in';
        break;
      case 'signout':
        currentStatus = 'signed_out';
        break;
      case 'break_start':
        currentStatus = 'on_break';
        break;
      case 'break_end':
        currentStatus = 'signed_in'; // After break ends, user is signed in
        break;
    }
  }

  return currentStatus;
}

/**
 * Gets the last activity from a list of attendance logs
 * 
 * @param logs Array of attendance logs
 * @returns The last activity or null if no logs
 */
export function getLastActivity(logs: AttendanceLog[]) {
  if (!logs || logs.length === 0) {
    return null;
  }

  // Sort logs by timestamp (descending) to get the most recent
  const sortedLogs = [...logs].sort(
    (a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime()
  );

  const lastLog = sortedLogs[0];
  
  return {
    type: lastLog.event_type as AttendanceEventType,
    timestamp: lastLog.timestamp
  };
}

/**
 * Gets a human-readable label for a user status
 * 
 * @param status The user status
 * @returns A human-readable label
 */
export function getStatusLabel(status: UserStatus): string {
  switch (status) {
    case 'signed_in': return 'Signed In';
    case 'signed_out': return 'Signed Out';
    case 'on_break': return 'On Break';
  }
}

/**
 * Converts an event type to a user status
 * 
 * @param eventType The attendance event type
 * @returns The corresponding user status
 */
export function eventTypeToStatus(eventType: AttendanceEventType): UserStatus {
  switch (eventType) {
    case 'signin': return 'signed_in';
    case 'signout': return 'signed_out';
    case 'break_start': return 'on_break';
    case 'break_end': return 'signed_in';
    default: return 'signed_out';
  }
}
