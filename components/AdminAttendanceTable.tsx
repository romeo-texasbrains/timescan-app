'use client';

import Link from 'next/link';
import { formatInTimeZone } from 'date-fns-tz';
import { useTimezone } from '@/context/TimezoneContext';
import { Database } from '@/lib/supabase/database.types';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import {
  ResponsiveTable,
  ResponsiveTableHeader,
  ResponsiveTableBody,
  ResponsiveTableHead,
  ResponsiveTableRow,
  ResponsiveTableCell,
  ResponsiveTableCaption
} from '@/components/ui/responsive-table';
import { ActionMenu, type ActionItem } from '@/components/ui/action-menu';

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
      <div className="mobile-container">
        <ResponsiveTable className="min-w-full divide-y divide-border/50">
          <ResponsiveTableHeader className="bg-primary/5">
            <tr>
              <ResponsiveTableHead className="px-6 py-4 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                Date & Time
              </ResponsiveTableHead>
              <ResponsiveTableHead className="px-6 py-4 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                Employee
              </ResponsiveTableHead>
              <ResponsiveTableHead className="px-6 py-4 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                Event Type
              </ResponsiveTableHead>
              <ResponsiveTableHead className="px-6 py-4 text-right text-xs font-semibold text-foreground uppercase tracking-wider">
                Actions
              </ResponsiveTableHead>
            </tr>
          </ResponsiveTableHeader>
          <ResponsiveTableBody className="divide-y divide-border/50">
            {logs.length > 0 ? (
              logs.map((log, idx) => {
                const profile = Array.isArray(log.profiles) ? log.profiles[0] : log.profiles;
                return (
                  <ResponsiveTableRow
                    key={log.id}
                    className={`transition-colors ${idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/10'} hover:bg-primary/5`}
                  >
                    <ResponsiveTableCell header="Date & Time" className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">
                          {formatInTimeZone(new Date(log.timestamp || ''), timezone, 'MMM d, yyyy')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatInTimeZone(new Date(log.timestamp || ''), timezone, 'h:mm a')}
                        </span>
                      </div>
                    </ResponsiveTableCell>
                    <ResponsiveTableCell header="Employee" className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-primary font-semibold text-sm">
                            {profile?.full_name?.split(' ').map(n => n[0]).join('') || '?'}
                          </span>
                        </div>
                        <div className="ml-2 max-w-[calc(100%-3rem)]">
                          <div className="text-sm font-medium text-foreground">{profile?.full_name || 'Unknown User'}</div>
                          <div className="text-xs text-muted-foreground truncate">{profile?.email || '-'}</div>
                        </div>
                      </div>
                    </ResponsiveTableCell>
                    <ResponsiveTableCell header="Event Type" className="px-6 py-4">
                      <div className="text-right">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${
                          log.event_type === 'signin'
                            ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                            : 'bg-red-500/10 text-red-600 dark:text-red-400'
                        }`}>
                          {log.event_type === 'signin' ? 'Punch In' : 'Punch Out'}
                        </span>
                      </div>
                    </ResponsiveTableCell>
                    <ResponsiveTableCell header="Actions" className="px-6 py-2 text-right">
                      <div className="flex justify-end">
                        <ActionMenu
                          actions={[
                            {
                              label: "Edit",
                              href: `/admin/logs/${log.id}`,
                              icon: <PencilIcon className="h-4 w-4 mr-2" />
                            },
                            {
                              label: "Delete",
                              disabled: true,
                              variant: "destructive",
                              icon: <TrashIcon className="h-4 w-4 mr-2" />
                            }
                          ]}
                        />
                      </div>
                    </ResponsiveTableCell>
                  </ResponsiveTableRow>
                );
              })
            ) : (
              <ResponsiveTableRow>
                <ResponsiveTableCell colSpan={4} className="px-6 py-8 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-muted-foreground/50 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm font-medium text-muted-foreground">No attendance records found</p>
                    <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters</p>
                  </div>
                </ResponsiveTableCell>
              </ResponsiveTableRow>
            )}
          </ResponsiveTableBody>
        </ResponsiveTable>
      </div>
    </div>
  );
}