'use client';

import Link from 'next/link';
import { formatInTimeZone } from 'date-fns-tz';
import { useTimezone } from '@/context/TimezoneContext';
import { Database } from '@/lib/supabase/database.types';

// Define shared types (can be moved to a types file later)
type ProfileSelection = Pick<
  Database['public']['Tables']['profiles']['Row'],
  'full_name' | 'email'
>;
type AttendanceLogSelection = Pick<
  Database['public']['Tables']['attendance_logs']['Row'],
  'id' | 'timestamp' | 'event_type'
>;
export type AdminLogRow = AttendanceLogSelection & {
  profiles: ProfileSelection[] | null;
};

interface AdminAttendanceTableProps {
  logs: AdminLogRow[];
}

export default function AdminAttendanceTable({ logs }: AdminAttendanceTableProps) {
  const { timezone } = useTimezone();

  const formatTimestamp = (timestamp: string | null | undefined): string => {
    if (!timestamp) return 'Invalid Date';
    try {
      return formatInTimeZone(new Date(timestamp), timezone, 'MMM d, yyyy h:mm a');
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return 'Invalid Date';
    }
  };

  return (
    <div className="bg-card/70 dark:bg-card/70 backdrop-blur-md border border-white/10 overflow-hidden shadow-lg rounded-xl transition-all duration-300 hover:shadow-xl">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border/50">
          <thead className="bg-primary/5">
            <tr>
              <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                Date & Time
              </th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                Employee
              </th>
              <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                Event Type
              </th>
              <th scope="col" className="px-6 py-4 text-right text-xs font-semibold text-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {logs.length > 0 ? (
              logs.map((log, idx) => {
                const profile = Array.isArray(log.profiles) ? log.profiles[0] : log.profiles;
                return (
                  <tr
                    key={log.id}
                    className={`transition-colors ${idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/10'} hover:bg-primary/5`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">
                          {formatInTimeZone(new Date(log.timestamp || ''), timezone, 'MMM d, yyyy')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatInTimeZone(new Date(log.timestamp || ''), timezone, 'h:mm a')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-primary font-semibold text-sm">
                            {profile?.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-foreground">{profile?.full_name || 'Unknown User'}</div>
                          <div className="text-xs text-muted-foreground">{profile?.email || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${
                        log.event_type === 'signin'
                          ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                          : 'bg-red-500/10 text-red-600 dark:text-red-400'
                      }`}>
                        {log.event_type === 'signin' ? 'Punch In' : 'Punch Out'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-2">
                        <Link
                          href={`/admin/logs/${log.id}`}
                          className="inline-flex items-center px-3 py-1 border border-primary/30 text-xs font-medium rounded-md text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                          </svg>
                          Edit
                        </Link>
                        <button
                          disabled
                          className="inline-flex items-center px-3 py-1 border border-destructive/30 text-xs font-medium rounded-md text-destructive bg-destructive/5 hover:bg-destructive/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-muted-foreground/50 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm font-medium text-muted-foreground">No attendance records found</p>
                    <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}