import React from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { formatInTimeZone } from 'date-fns-tz';
import { parseISO } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { formatDuration, MAX_SHIFT_DURATION_HOURS } from '@/lib/shift-utils';
import { AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSupabase } from '@/components/providers/supabase-provider';

type EntryType = {
  in: string | null;
  out: string | null;
  breakStart?: string | null;
  breakEnd?: string | null;
};

interface AttendanceReportCardProps {
  employeeName: string;
  employeeId: string;
  totalHours: number;
  entries: EntryType[];
  timezone: string;
  date: string;
  canEdit?: boolean;
  currentUserId?: string;
  wasCapped?: boolean;
  profilePictureUrl?: string | null;
}

// We're now using the formatDuration function from lib/shift-utils.ts

// Helper function to get initials from name
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase();
}

export default function AttendanceReportCard({
  employeeName,
  employeeId,
  totalHours,
  entries,
  timezone,
  date,
  canEdit = false,
  currentUserId,
  wasCapped = false,
  profilePictureUrl = null
}: AttendanceReportCardProps) {
  // Format the total hours
  const formattedHours = formatDuration(totalHours);

  // Get the first entry's login time and last entry's logout time for display
  const firstLogin = entries.find(entry => entry.in)?.in || null;
  const lastLogout = [...entries].reverse().find(entry => entry.out)?.out || null;

  // Calculate total break time in seconds
  const breakTimeSeconds = entries.reduce((total, entry) => {
    if (entry.breakStart && entry.breakEnd) {
      const breakStart = parseISO(entry.breakStart).getTime();
      const breakEnd = parseISO(entry.breakEnd).getTime();
      return total + (breakEnd - breakStart) / 1000; // in seconds
    }
    return total;
  }, 0);

  // Format break time in hours and minutes
  const formattedBreakTime = breakTimeSeconds > 0
    ? formatDuration(breakTimeSeconds)
    : 'None';

  // Determine if this is the current user's card
  const isSelfCard = currentUserId === employeeId;

  // Only allow editing if canEdit is true and it's not the current user's card (managers can't edit their own)
  const showEditButton = canEdit && (!isSelfCard || currentUserId === 'admin');

  return (
    <Card className="p-4 mb-4 hover:shadow-md transition-shadow">
      <div className="flex items-start">
        {/* Avatar/Initials */}
        <div className="mr-4">
          <Avatar className="h-16 w-16 border-2 border-primary/20">
            {profilePictureUrl ? (
              <AvatarImage src={profilePictureUrl} alt={employeeName} />
            ) : (
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                {getInitials(employeeName)}
              </AvatarFallback>
            )}
          </Avatar>
        </div>

        {/* Employee Info */}
        <div className="flex-1">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-xl font-semibold text-foreground">{employeeName}</h3>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-primary flex items-center">
                {formattedHours}
                {wasCapped && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="ml-1">
                          <AlertCircle size={16} className="text-amber-500" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Shift duration capped at {MAX_SHIFT_DURATION_HOURS} hours</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>

              {/* Edit Button - Only shown for admins/managers and not for their own card */}
              {showEditButton && (
                <Link
                  href={`/attendance/edit?employeeId=${employeeId}&date=${date}${wasCapped ? '&wasCapped=true' : ''}`}
                  className="p-2 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                  title="Edit attendance record"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </Link>
              )}
            </div>
          </div>

          <div className="text-sm text-muted-foreground mb-2">Working hours</div>

          <div className="grid grid-cols-2 gap-2">
            {/* Login Time */}
            <div>
              <div className="text-sm text-muted-foreground">Login:</div>
              <div className="font-medium">
                {firstLogin
                  ? formatInTimeZone(parseISO(firstLogin), timezone, 'h:mm a')
                  : 'N/A'}
              </div>
            </div>

            {/* Logout Time */}
            <div>
              <div className="text-sm text-muted-foreground">Logout:</div>
              <div className="font-medium">
                {lastLogout
                  ? formatInTimeZone(parseISO(lastLogout), timezone, 'h:mm a')
                  : 'N/A'}
              </div>
            </div>
          </div>

          {/* Break Time */}
          <div className="mt-2">
            <div className="text-sm text-muted-foreground">Break:</div>
            <div className="font-medium">
              {formattedBreakTime}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
