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
    <div className="bg-card/70 dark:bg-card/70 backdrop-blur-md border border-white/5 overflow-hidden shadow-lg rounded-xl">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border/50">
          <thead className="bg-muted/20 dark:bg-muted/20">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Date & Time
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Employee
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Event Type
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {logs.length > 0 ? (
              logs.map((log) => {
                const profile = Array.isArray(log.profiles) ? log.profiles[0] : log.profiles;
                return (
                  <tr key={log.id} className="hover:bg-accent/30 dark:hover:bg-accent/30 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-foreground">{profile?.full_name || 'Unknown User'}</div>
                      <div className="text-sm text-muted-foreground">{profile?.email || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${
                        log.event_type === 'signin'
                          ? 'bg-green-900/70 text-green-100'
                          : 'bg-red-900/70 text-red-100'
                      }`}>
                        {log.event_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                      <Link href={`/admin/logs/${log.id}`} className="text-primary/90 hover:text-primary font-medium">
                        Edit
                      </Link>
                      <button
                        disabled // Implement delete functionality later
                        className="text-destructive/70 hover:text-destructive disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-sm text-muted-foreground">
                  No attendance records found matching filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
} 