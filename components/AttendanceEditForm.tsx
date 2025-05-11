'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatInTimeZone, format as formatTz, toDate } from 'date-fns-tz';
import { parseISO, format, addDays, isAfter, isBefore, isEqual, addMinutes } from 'date-fns';
import { useRouter } from 'next/navigation';
import { updateAttendanceLogs } from '@/app/actions/attendanceActions';
import { Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { MAX_SHIFT_DURATION_HOURS } from '@/lib/shift-utils';

type AttendanceLog = {
  id: string;
  timestamp: string;
  event_type: string;
};

interface AttendanceEditFormProps {
  employeeId: string;
  employeeName: string;
  date: string;
  logs: AttendanceLog[];
  timezone: string;
  userRole: string;
  wasCapped?: boolean;
}

export default function AttendanceEditForm({
  employeeId,
  employeeName,
  date,
  logs,
  timezone,
  userRole,
  wasCapped = false
}: AttendanceEditFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Log the logs we received for debugging
  console.log('Attendance Edit - Received logs:', logs);

  // Group logs by event type
  const signinLogs = logs.filter(log => log.event_type === 'signin');
  const signoutLogs = logs.filter(log => log.event_type === 'signout');
  const breakStartLogs = logs.filter(log => log.event_type === 'break_start');
  const breakEndLogs = logs.filter(log => log.event_type === 'break_end');

  // Calculate total break time in minutes
  let totalBreakMinutes = 0;
  if (breakStartLogs.length > 0 && breakEndLogs.length > 0) {
    const breakStart = parseISO(breakStartLogs[0].timestamp);
    const breakEnd = parseISO(breakEndLogs[0].timestamp);
    totalBreakMinutes = Math.round((breakEnd.getTime() - breakStart.getTime()) / 1000 / 60);
  }

  // Format times in the admin timezone
  const formatTimeInAdminTz = (timestamp: string | null): string => {
    if (!timestamp) return '';
    return formatInTimeZone(parseISO(timestamp), timezone, 'HH:mm');
  };

  // Initialize form state with existing logs
  const [formState, setFormState] = useState({
    signin: formatTimeInAdminTz(signinLogs[0]?.timestamp),
    signout: formatTimeInAdminTz(signoutLogs[0]?.timestamp),
    breakMinutes: totalBreakMinutes > 0 ? totalBreakMinutes.toString() : '',
    signinId: signinLogs[0]?.id || '',
    signoutId: signoutLogs[0]?.id || '',
    breakStartId: breakStartLogs[0]?.id || '',
    breakEndId: breakEndLogs[0]?.id || '',
    // Store original timestamps for reference
    originalSigninTime: signinLogs[0]?.timestamp || null,
    originalSignoutTime: signoutLogs[0]?.timestamp || null,
    originalBreakStartTime: breakStartLogs[0]?.timestamp || null,
    originalBreakEndTime: breakEndLogs[0]?.timestamp || null,
    // Store the original date from the URL for consistency
    originalDate: date,
    action: 'update' // 'update' or 'delete'
  });

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({ ...prev, [name]: value }));
  };

  // Handle select changes
  const handleSelectChange = (value: string) => {
    setFormState(prev => ({ ...prev, action: value }));
  };

  /**
   * Parse a time string in either 12-hour (hh:mm AM/PM) or 24-hour (HH:mm) format
   * and return hours and minutes as numbers
   */
  const parseTimeString = (timeString: string): { hours: number, minutes: number } | null => {
    try {
      // Check if the time string is in 12-hour format (contains AM/PM)
      if (timeString.toLowerCase().includes('am') || timeString.toLowerCase().includes('pm')) {
        // Parse 12-hour format (e.g., "05:00 PM")
        const match = timeString.match(/(\d+):(\d+)\s*(am|pm)/i);
        if (!match) return null;

        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const period = match[3].toLowerCase();

        // Convert to 24-hour format
        if (period === 'pm' && hours < 12) {
          hours += 12;
        } else if (period === 'am' && hours === 12) {
          hours = 0;
        }

        return { hours, minutes };
      } else {
        // Parse 24-hour format (e.g., "17:00")
        const [hoursStr, minutesStr] = timeString.split(':');
        const hours = parseInt(hoursStr, 10);
        const minutes = parseInt(minutesStr, 10);

        return { hours, minutes };
      }
    } catch (error) {
      console.error('Error parsing time string:', timeString, error);
      return null;
    }
  };

  /**
   * Converts a time string to a UTC ISO string based on the admin timezone
   * and the shift's anchor date, properly handling overnight shifts
   */
  const timeToUTC = (
    timeString: string,
    eventType: 'signin' | 'signout' | 'break_start' | 'break_end',
    shiftAnchorDate: string, // The primary date of the shift (YYYY-MM-DD)
    currentSigninTimeStr?: string // Pass current signin time string for overnight logic
  ): string | null => {
    if (!timeString) return null;

    try {
      console.log(`[timeToUTC] Converting ${eventType} time: "${timeString}" with anchor date: "${shiftAnchorDate}", adminTimezone: "${timezone}"`);

      const parsedTime = parseTimeString(timeString);
      if (!parsedTime) {
        console.error(`[timeToUTC] Failed to parse time string: "${timeString}"`);
        return null;
      }

      const { hours, minutes } = parsedTime;
      const formattedTimeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      console.log(`[timeToUTC] Parsed time: "${timeString}" -> ${formattedTimeStr} (${hours}h ${minutes}m)`);

      let localDateForEvent = shiftAnchorDate;

      // Determine if this event should be on the next day (for overnight shifts)
      if (currentSigninTimeStr && (eventType === 'signout' || eventType === 'break_start' || eventType === 'break_end')) {
        const signinParsed = parseTimeString(currentSigninTimeStr);
        if (signinParsed) {
          // For signout: if time is earlier than signin, it's likely on the next day
          if (eventType === 'signout') {
            if (hours < signinParsed.hours || (hours === signinParsed.hours && minutes < signinParsed.minutes)) {
              const nextDay = addDays(parseISO(shiftAnchorDate), 1);
              localDateForEvent = format(nextDay, 'yyyy-MM-dd');
              console.log(`[timeToUTC] Detected overnight shift for signout, using date: ${localDateForEvent}`);
            }
          }
          // For breaks: more complex logic based on signin/signout pattern
          else if (eventType === 'break_start' || eventType === 'break_end') {
            // Check if this is an overnight shift based on signin/signout
            const isSigninPM = signinParsed.hours >= 12;
            const isBreakAM = hours < 12;

            // If signin is PM and break is AM, break is likely on next day
            if (isSigninPM && isBreakAM && hours < signinParsed.hours) {
              const nextDay = addDays(parseISO(shiftAnchorDate), 1);
              localDateForEvent = format(nextDay, 'yyyy-MM-dd');
              console.log(`[timeToUTC] Break time ${formattedTimeStr} on next day: ${localDateForEvent}`);
            }
            // Special case: both signin and break are AM, but break is earlier
            else if (!isSigninPM && isBreakAM && hours < signinParsed.hours && formState.signout) {
              const signoutParsed = parseTimeString(formState.signout);
              // If signout suggests an overnight shift and break is before signin
              if (signoutParsed && (signoutParsed.hours < signinParsed.hours)) {
                const nextDay = addDays(parseISO(shiftAnchorDate), 1);
                localDateForEvent = format(nextDay, 'yyyy-MM-dd');
                console.log(`[timeToUTC] Break time ${formattedTimeStr} on next day due to overnight signout: ${localDateForEvent}`);
              }
            }
          }
        }
      }

      // Construct the full local datetime string in admin timezone
      const localDateTimeStr = `${localDateForEvent}T${formattedTimeStr}:00`;
      console.log(`[timeToUTC] Constructed local datetime string (in ${timezone}): "${localDateTimeStr}"`);

      // Use toDate from date-fns-tz to correctly convert from local time in the admin timezone to UTC
      // This is the key fix - toDate properly handles the timezone conversion
      const utcDate = toDate(localDateTimeStr, { timeZone: timezone });

      const result = utcDate.toISOString();
      console.log(`[timeToUTC] Converted to UTC: "${result}"`);
      return result;
    } catch (error) {
      console.error(`[timeToUTC] Error converting ${eventType} time "${timeString}" to UTC:`, error);
      return null;
    }
  };

  /**
   * Determines if a shift is an overnight shift based on signin and signout times
   */
  const isOvernightShift = (signinTime: string, signoutTime: string): boolean => {
    if (!signinTime || !signoutTime) return false;

    try {
      // Parse the time strings (HH:mm format)
      const signinParsed = parseTimeString(signinTime);
      const signoutParsed = parseTimeString(signoutTime);

      if (!signinParsed || !signoutParsed) return false;

      // Convert to total minutes for easier comparison
      const signinTotalMinutes = signinParsed.hours * 60 + signinParsed.minutes;
      const signoutTotalMinutes = signoutParsed.hours * 60 + signoutParsed.minutes;

      // If signout time is earlier than signin time, it's an overnight shift
      return signoutTotalMinutes < signinTotalMinutes;
    } catch (error) {
      console.error('Error determining if shift is overnight:', error);
      return false;
    }
  };



  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      console.log('Form submission - Current form state:', formState);

      // Validate required fields for update action
      if (formState.action === 'update' && (!formState.signin || !formState.signout)) {
        toast.error('Sign in and sign out times are required');
        setIsSubmitting(false);
        return;
      }

      // Determine the shift anchor date - this is the date we're editing
      const shiftAnchorDate = date;
      console.log(`Shift anchor date: ${shiftAnchorDate}`);

      // Determine if this is an overnight shift based on the input times
      const overnight = isOvernightShift(formState.signin, formState.signout);
      console.log(`Is overnight shift based on input times: ${overnight}`);

      // Convert signin and signout times to UTC
      const signinTime = formState.signin
        ? timeToUTC(formState.signin, 'signin', shiftAnchorDate)
        : null;

      const signoutTime = formState.signout
        ? timeToUTC(formState.signout, 'signout', shiftAnchorDate, formState.signin)
        : null;

      console.log(`Converted signin time: ${signinTime}`);
      console.log(`Converted signout time: ${signoutTime}`);

      // Validate that signout is after signin
      if (signinTime && signoutTime) {
        const signinDate = new Date(signinTime);
        const signoutDate = new Date(signoutTime);

        if (!isAfter(signoutDate, signinDate)) {
          toast.error('Sign out time must be after sign in time');
          setIsSubmitting(false);
          return;
        }
      }

      // Calculate break times if break minutes is provided
      const breakMinutes = parseInt(formState.breakMinutes) || 0;
      let breakStart = null;
      let breakEnd = null;

      if (breakMinutes > 0 && signinTime && signoutTime) {
        // We need valid signin and signout times to calculate breaks

        // Get the signin and signout times as Date objects
        const signinDate = new Date(signinTime);
        const signoutDate = new Date(signoutTime);

        // Determine if this is an overnight shift based on the UTC dates
        const isOvernightShift = signinDate.getUTCDate() !== signoutDate.getUTCDate();
        console.log(`Is overnight shift based on UTC dates: ${isOvernightShift}`);

        // For automatic break calculation, we'll place the break at a reasonable time within the shift
        try {
          // Get the signin and signout times as Date objects
          const signinDate = parseISO(signinTime);
          const signoutDate = parseISO(signoutTime);

          // Calculate the shift duration in minutes
          const shiftDurationMinutes = (signoutDate.getTime() - signinDate.getTime()) / (60 * 1000);
          console.log(`[handleSubmit] Shift duration: ${shiftDurationMinutes} minutes`);

          // Place the break at 1/3 of the way through the shift
          const breakStartOffsetMs = Math.floor(shiftDurationMinutes / 3) * 60 * 1000;
          console.log(`[handleSubmit] Break will start ${breakStartOffsetMs / (60 * 1000)} minutes after signin`);

          // Calculate the break start time by adding minutes to signin time
          const breakStartDate = new Date(signinDate.getTime() + breakStartOffsetMs);
          const breakEndDate = addMinutes(breakStartDate, breakMinutes);

          // Ensure break end is before signout
          if (isAfter(breakEndDate, signoutDate)) {
            // If break would end after signout, adjust it to end 5 minutes before signout
            const adjustedBreakEnd = addMinutes(signoutDate, -5);
            console.log('[handleSubmit] Adjusted break end to be 5 minutes before signout');

            // Also adjust break start if needed to maintain the break duration
            const adjustedBreakStart = addMinutes(adjustedBreakEnd, -breakMinutes);

            // Ensure break start is after signin
            if (isBefore(adjustedBreakStart, signinDate)) {
              // If break would start before signin, set it to start 5 minutes after signin
              const newBreakStart = addMinutes(signinDate, 5);
              console.log('[handleSubmit] Adjusted break start to be 5 minutes after signin');

              // Recalculate break end time
              const newBreakEnd = addMinutes(newBreakStart, breakMinutes);

              // Final check to ensure break end is before signout
              if (isAfter(newBreakEnd, signoutDate)) {
                // Use the adjusted break end (5 minutes before signout)
                breakStart = newBreakStart.toISOString();
                breakEnd = adjustedBreakEnd.toISOString();
                console.log('[handleSubmit] Final adjustment: break end set to 5 minutes before signout');
              } else {
                // Use the new break times
                breakStart = newBreakStart.toISOString();
                breakEnd = newBreakEnd.toISOString();
              }
            } else {
              // Use the adjusted break times
              breakStart = adjustedBreakStart.toISOString();
              breakEnd = adjustedBreakEnd.toISOString();
            }
          } else {
            // Break fits within the shift, use the calculated times
            breakStart = breakStartDate.toISOString();
            breakEnd = breakEndDate.toISOString();
          }

          console.log(`[handleSubmit] Final break start time: ${breakStart}`);
          console.log(`[handleSubmit] Final break end time: ${breakEnd}`);

          // Log the break duration in minutes
          if (breakStart && breakEnd) {
            const actualBreakDuration = (parseISO(breakEnd).getTime() - parseISO(breakStart).getTime()) / (60 * 1000);
            console.log(`[handleSubmit] Actual break duration: ${actualBreakDuration} minutes`);
          }
        } catch (error) {
          console.error('[handleSubmit] Error calculating break times:', error);
          // Don't fail the form submission for break calculation errors
          // Just set break times to null
          breakStart = null;
          breakEnd = null;
        }


      }

      // Log the calculated times for debugging
      console.log('Attendance Edit - Calculated times:');
      console.log('Original signin time:', formState.originalSigninTime);
      console.log('New signin time:', signinTime);
      console.log('Original signout time:', formState.originalSignoutTime);
      console.log('New signout time:', signoutTime);
      console.log('Break start time:', breakStart);
      console.log('Break end time:', breakEnd);

      // Check if this is an overnight shift based on input times
      const isOvernightShiftInput = isOvernightShift(formState.signin, formState.signout);
      console.log('Is overnight shift (based on input times):', isOvernightShiftInput);

      // Check if this is an overnight shift based on UTC dates
      if (signinTime && signoutTime) {
        const signinDate = new Date(signinTime);
        const signoutDate = new Date(signoutTime);
        const isOvernightUTC = signinDate.getUTCDate() !== signoutDate.getUTCDate();
        console.log('Is overnight shift (based on UTC dates):', isOvernightUTC);

        // The definitive overnight shift status should be based on the input times
        console.log('Final overnight shift status:', isOvernightShiftInput);

        // Additional validation for overnight shifts
        if (isOvernightShiftInput) {
          // Ensure signout is on the next day
          const expectedSignoutDay = new Date(signinDate);
          expectedSignoutDay.setUTCDate(expectedSignoutDay.getUTCDate() + 1);

          if (signoutDate.getUTCDate() !== expectedSignoutDay.getUTCDate()) {
            console.warn('Signout date is not on the expected next day for overnight shift');
          }
        }
      }

      // Prepare the data for submission
      const updateData = {
        employeeId,
        date: shiftAnchorDate, // Use the shift anchor date for consistency
        action: formState.action,
        logs: [
          {
            id: formState.signinId,
            timestamp: signinTime,
            event_type: 'signin'
          },
          {
            id: formState.signoutId,
            timestamp: signoutTime,
            event_type: 'signout'
          },
          {
            id: formState.breakStartId,
            timestamp: breakStart,
            event_type: 'break_start'
          },
          {
            id: formState.breakEndId,
            timestamp: breakEnd,
            event_type: 'break_end'
          }
        ].filter(log => log.timestamp !== null) // Filter out empty logs
      };

      // Call the server action to update the logs
      const result = await updateAttendanceLogs(updateData);

      if (result.success) {
        toast.success(result.message);
        // Redirect back to the reports page
        const redirectPath = userRole === 'admin' ? '/admin/reports' : '/mgmt/reports';
        router.push(redirectPath);
      } else {
        toast.error(result.message || 'Failed to update attendance logs');
      }
    } catch (error) {
      console.error('Error updating attendance logs:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sign In Time */}
        <div className="space-y-2">
          <Label htmlFor="signin">Sign In Time</Label>
          <Input
            id="signin"
            name="signin"
            type="time"
            value={formState.signin}
            onChange={handleInputChange}
            className="w-full"
          />
        </div>

        {/* Sign Out Time */}
        <div className="space-y-2">
          <Label htmlFor="signout">Sign Out Time</Label>
          <Input
            id="signout"
            name="signout"
            type="time"
            value={formState.signout}
            onChange={handleInputChange}
            className="w-full"
          />
        </div>

        {/* Break Duration (in minutes) */}
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="breakMinutes">Break Duration (minutes)</Label>
          <div className="flex items-center">
            <Input
              id="breakMinutes"
              name="breakMinutes"
              type="number"
              min="0"
              max="480" // 8 hours max
              value={formState.breakMinutes}
              onChange={handleInputChange}
              className="w-full"
              placeholder="Enter break duration in minutes"
            />
            <div className="ml-2 text-sm text-muted-foreground whitespace-nowrap">
              {parseInt(formState.breakMinutes) > 0 && (
                <>
                  {Math.floor(parseInt(formState.breakMinutes) / 60) > 0 && (
                    <span>{Math.floor(parseInt(formState.breakMinutes) / 60)}h </span>
                  )}
                  {parseInt(formState.breakMinutes) % 60 > 0 && (
                    <span>{parseInt(formState.breakMinutes) % 60}m</span>
                  )}
                </>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Break will be automatically scheduled 2 hours after sign-in time
          </p>
        </div>
      </div>

      {/* Action Selection */}
      <div className="space-y-2">
        <Label htmlFor="action">Action</Label>
        <Select
          value={formState.action}
          onValueChange={handleSelectChange}
        >
          <SelectTrigger id="action" className="w-full">
            <SelectValue placeholder="Select action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="update">Update Attendance Records</SelectItem>
            <SelectItem value="delete">Delete All Records for This Day</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Warning Message */}
      <div className="text-amber-500 text-sm">
        <p>Warning: Editing attendance records will affect time calculations and reports.</p>
        {formState.action === 'delete' && (
          <p className="font-bold mt-1">Deleting records cannot be undone!</p>
        )}
        {wasCapped && (
          <div className="flex items-center mt-2 p-2 bg-amber-100 dark:bg-amber-950 rounded-md">
            <AlertCircle className="h-4 w-4 mr-2 flex-shrink-0" />
            <p>
              This shift was automatically capped at {MAX_SHIFT_DURATION_HOURS} hours.
              Your edits will remove this cap and use the exact times you specify.
            </p>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex justify-end space-x-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className={formState.action === 'delete' ? 'bg-destructive hover:bg-destructive/90' : ''}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : formState.action === 'delete' ? (
            'Delete Records'
          ) : (
            'Update Records'
          )}
        </Button>
      </div>
    </form>
  );
}
