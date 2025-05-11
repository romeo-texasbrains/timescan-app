import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import AttendanceEditForm from '@/components/AttendanceEditForm';
import { MAX_SHIFT_DURATION_SECONDS } from '@/lib/shift-utils';

interface AttendanceEditPageProps {
  searchParams: {
    employeeId?: string;
    date?: string;
    wasCapped?: string; // URL parameter to explicitly mark a shift as capped
  };
}

export default async function AttendanceEditPage({ searchParams }: AttendanceEditPageProps) {
  const supabase = await createClient();

  // --- Authorization Check ---
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return redirect('/login?message=Unauthorized');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, department_id')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Error fetching user profile:', profileError);
    return redirect('/?message=Error fetching user profile');
  }

  // Only admins and managers can access this page
  if (profile.role !== 'admin' && profile.role !== 'manager') {
    return redirect('/?message=Unauthorized access');
  }

  // Get required parameters - await searchParams
  const awaitedParams = await searchParams;
  const employeeId = awaitedParams.employeeId;
  const date = awaitedParams.date;
  const wasCappedParam = awaitedParams.wasCapped;

  if (!employeeId || !date) {
    return redirect('/admin/reports?message=Missing required parameters');
  }

  // Validate date format (should be YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    console.error('Invalid date format:', date);
    return redirect(`/${profile.role === 'admin' ? 'admin' : 'mgmt'}/reports?message=Invalid date format`);
  }

  console.log('Edit page - Processing request for employee:', employeeId, 'on date:', date);

  // For managers, verify they can edit this employee (same department and not themselves)
  if (profile.role === 'manager') {
    // Managers can't edit their own records
    if (employeeId === user.id) {
      return redirect('/mgmt/reports?message=You cannot edit your own attendance records');
    }

    // Check if employee is in the manager's department
    const { data: employeeProfile, error: employeeError } = await supabase
      .from('profiles')
      .select('department_id')
      .eq('id', employeeId)
      .single();

    if (employeeError) {
      console.error('Error fetching employee profile:', employeeError);
      return redirect('/mgmt/reports?message=Error fetching employee profile');
    }

    if (employeeProfile.department_id !== profile.department_id) {
      return redirect('/mgmt/reports?message=You can only edit employees in your department');
    }
  }

  // --- Fetch Timezone Setting ---
  let timezone = 'UTC'; // Default timezone
  try {
    const { data: settings, error: tzError } = await supabase
      .from('app_settings')
      .select('timezone')
      .eq('id', 1)
      .single();

    if (tzError) {
      if (tzError.code !== 'PGRST116') { // Ignore row not found
        console.error("Error fetching timezone setting:", tzError);
      }
    } else if (settings?.timezone) {
      timezone = settings.timezone;
    }
  } catch (error) {
    console.error("Error fetching timezone setting:", error);
  }

  // --- Fetch Employee Details ---
  const { data: employeeData, error: employeeDataError } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', employeeId)
    .single();

  if (employeeDataError) {
    console.error('Error fetching employee details:', employeeDataError);
    return redirect(`/${profile.role === 'admin' ? 'admin' : 'mgmt'}/reports?message=Error fetching employee details`);
  }

  const employeeName = employeeData.full_name || 'Unknown Employee';

  // --- Fetch Attendance Logs for the Date ---
  // We need to fetch logs for both the specified date and potentially adjacent days
  // to handle overnight shifts properly

  // Parse the date parameter
  const anchorDate = new Date(date);
  anchorDate.setUTCHours(0, 0, 0, 0);

  // Get the previous and next days
  const prevDate = new Date(anchorDate);
  prevDate.setUTCDate(prevDate.getUTCDate() - 1);

  const nextDate = new Date(anchorDate);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);

  // Format date strings for queries
  const prevDayStart = prevDate.toISOString();
  const anchorDayStart = anchorDate.toISOString();

  const nextDayEnd = new Date(nextDate);
  nextDayEnd.setUTCHours(23, 59, 59, 999);
  const nextDayEndStr = nextDayEnd.toISOString();

  console.log(`Fetching logs for employee ${employeeId} from ${prevDayStart} to ${nextDayEndStr}`);

  // Fetch all logs in a 3-day window (previous, anchor, and next day)
  // This ensures we capture all logs for overnight shifts
  const { data: allLogs, error: logsError } = await supabase
    .from('attendance_logs')
    .select('id, timestamp, event_type')
    .eq('user_id', employeeId)
    .gte('timestamp', prevDayStart)
    .lte('timestamp', nextDayEndStr)
    .order('timestamp', { ascending: true });

  if (logsError) {
    console.error('Error fetching attendance logs:', logsError);
    return redirect(`/${profile.role === 'admin' ? 'admin' : 'mgmt'}/reports?message=Error fetching attendance logs`);
  }

  console.log(`Found ${allLogs?.length || 0} logs in the 3-day window`);

  // Now we need to determine which logs belong to the shift we want to edit
  // This is tricky because a shift can start on one day and end on another

  // First, check if we have logs on the anchor date
  const anchorDayLogs = allLogs?.filter(log => {
    const logDate = new Date(log.timestamp);
    return logDate.getUTCFullYear() === anchorDate.getUTCFullYear() &&
           logDate.getUTCMonth() === anchorDate.getUTCMonth() &&
           logDate.getUTCDate() === anchorDate.getUTCDate();
  }) || [];

  console.log(`Found ${anchorDayLogs.length} logs on the anchor date ${date}`);

  // Check if we have a signin and signout on the anchor date
  const hasSigninOnAnchorDay = anchorDayLogs.some(log => log.event_type === 'signin');
  const hasSignoutOnAnchorDay = anchorDayLogs.some(log => log.event_type === 'signout');

  let logs = [];

  // Case 1: We have both signin and signout on the anchor day - simple case
  if (hasSigninOnAnchorDay && hasSignoutOnAnchorDay) {
    console.log('Found complete shift on anchor day');
    logs = anchorDayLogs;
  }
  // Case 2: We have signin but no signout on anchor day - potential overnight shift
  else if (hasSigninOnAnchorDay && !hasSignoutOnAnchorDay) {
    console.log('Found signin but no signout on anchor day - checking next day');

    // Get the signin from anchor day
    const signinLog = anchorDayLogs.find(log => log.event_type === 'signin');

    // Check for signout on next day
    const nextDayLogs = allLogs?.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate.getUTCFullYear() === nextDate.getUTCFullYear() &&
             logDate.getUTCMonth() === nextDate.getUTCMonth() &&
             logDate.getUTCDate() === nextDate.getUTCDate();
    }) || [];

    const signoutOnNextDay = nextDayLogs.find(log => log.event_type === 'signout');

    if (signoutOnNextDay) {
      console.log('Found overnight shift spanning anchor day and next day');

      // Include all logs between signin and signout
      logs = allLogs?.filter(log => {
        const logTime = new Date(log.timestamp).getTime();
        const signinTime = new Date(signinLog!.timestamp).getTime();
        const signoutTime = new Date(signoutOnNextDay.timestamp).getTime();

        return logTime >= signinTime && logTime <= signoutTime;
      }) || [];
    } else {
      // No signout found on next day, just use anchor day logs
      logs = anchorDayLogs;
    }
  }
  // Case 3: We have signout but no signin on anchor day - overnight shift from previous day
  else if (!hasSigninOnAnchorDay && hasSignoutOnAnchorDay) {
    console.log('Found signout but no signin on anchor day - checking previous day');

    // Get the signout from anchor day
    const signoutLog = anchorDayLogs.find(log => log.event_type === 'signout');

    // Check for signin on previous day
    const prevDayLogs = allLogs?.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate.getUTCFullYear() === prevDate.getUTCFullYear() &&
             logDate.getUTCMonth() === prevDate.getUTCMonth() &&
             logDate.getUTCDate() === prevDate.getUTCDate();
    }) || [];

    const signinOnPrevDay = prevDayLogs.find(log => log.event_type === 'signin');

    if (signinOnPrevDay) {
      console.log('Found overnight shift spanning previous day and anchor day');

      // Include all logs between signin and signout
      logs = allLogs?.filter(log => {
        const logTime = new Date(log.timestamp).getTime();
        const signinTime = new Date(signinOnPrevDay.timestamp).getTime();
        const signoutTime = new Date(signoutLog!.timestamp).getTime();

        return logTime >= signinTime && logTime <= signoutTime;
      }) || [];
    } else {
      // No signin found on previous day, just use anchor day logs
      logs = anchorDayLogs;
    }
  }
  // Case 4: No signin or signout on anchor day - check for complete shift spanning prev to next
  else {
    console.log('No signin or signout on anchor day - checking for shift spanning multiple days');

    // Look for the most recent signin before the anchor day that doesn't have a matching signout
    const prevDayLogs = allLogs?.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate.getUTCFullYear() === prevDate.getUTCFullYear() &&
             logDate.getUTCMonth() === prevDate.getUTCMonth() &&
             logDate.getUTCDate() === prevDate.getUTCDate();
    }) || [];

    const signinOnPrevDay = prevDayLogs.find(log => log.event_type === 'signin');

    // Look for signout on next day
    const nextDayLogs = allLogs?.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate.getUTCFullYear() === nextDate.getUTCFullYear() &&
             logDate.getUTCMonth() === nextDate.getUTCMonth() &&
             logDate.getUTCDate() === nextDate.getUTCDate();
    }) || [];

    const signoutOnNextDay = nextDayLogs.find(log => log.event_type === 'signout');

    if (signinOnPrevDay && signoutOnNextDay) {
      console.log('Found shift spanning previous day, anchor day, and next day');

      // Include all logs between signin and signout
      logs = allLogs?.filter(log => {
        const logTime = new Date(log.timestamp).getTime();
        const signinTime = new Date(signinOnPrevDay.timestamp).getTime();
        const signoutTime = new Date(signoutOnNextDay.timestamp).getTime();

        return logTime >= signinTime && logTime <= signoutTime;
      }) || [];
    } else {
      // No complete shift found spanning multiple days, use anchor day logs
      logs = anchorDayLogs;
    }
  }

  // If we still don't have any logs, just use all logs from the 3-day window
  if (logs.length === 0) {
    console.log('No shift found, using all logs from the 3-day window');
    logs = allLogs || [];
  }

  // Sort logs by timestamp
  logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  console.log('Logs for editing:', logs);

  // Check if this shift was capped due to exceeding maximum duration
  let wasCapped = false;
  const signinLog = logs.find(log => log.event_type === 'signin');
  const signoutLog = logs.find(log => log.event_type === 'signout');

  if (signinLog && signoutLog) {
    const signinTime = new Date(signinLog.timestamp).getTime();
    const signoutTime = new Date(signoutLog.timestamp).getTime();
    const durationSeconds = (signoutTime - signinTime) / 1000;

    // Check if the duration is exactly or very close to the maximum (within 1 second)
    // This handles potential floating point precision issues
    wasCapped = Math.abs(durationSeconds - MAX_SHIFT_DURATION_SECONDS) < 1;

    // Also check if this is an overnight shift with a long duration
    // For the specific case in the screenshot (07:25 PM to 04:01 AM)
    const signinHour = new Date(signinLog.timestamp).getUTCHours();
    const signoutHour = new Date(signoutLog.timestamp).getUTCHours();

    // If signin is in evening (after 6pm) and signout is in morning (before 6am)
    // and the duration is close to a multiple of 8 hours (common cap)
    if (signinHour >= 18 && signoutHour <= 6) {
      const hourDuration = durationSeconds / 3600;
      // Check if it's close to 8, 16, or 24 hours (common caps)
      if (Math.abs(hourDuration - 8) < 0.1 ||
          Math.abs(hourDuration - 16) < 0.1 ||
          Math.abs(hourDuration - 24) < 0.1) {
        wasCapped = true;
      }
    }

    console.log(`Checking if shift was capped: Duration=${durationSeconds/3600}h, wasCapped=${wasCapped}`);
  }

  // Also check if the URL explicitly indicates this was a capped shift
  if (wasCappedParam === 'true' || wasCappedParam === '1') {
    console.log('Shift explicitly marked as capped via URL parameter');
    wasCapped = true;
  }

  // Format the date for display
  const formattedDate = format(parseISO(date), 'MMMM d, yyyy');

  // Determine the back link based on user role
  const backLink = profile.role === 'admin' ? '/admin/reports' : '/mgmt/reports';

  return (
    <div className="container mx-auto px-4 py-6 space-y-8 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Edit Attendance Record</h1>
          <p className="text-muted-foreground mt-1">
            {employeeName} - {formattedDate}
          </p>
        </div>
        <Link href={backLink}>
          <Button
            variant="outline"
            className="bg-card/70 hover:bg-primary/10 border-border/50 text-foreground transition-colors flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to Reports
          </Button>
        </Link>
      </div>

      <Card className="bg-card/70 dark:bg-card/70 backdrop-blur-md border border-white/10 rounded-xl shadow-lg transition-all duration-300 hover:shadow-xl">
        <CardHeader>
          <CardTitle>Attendance Logs for {formattedDate}</CardTitle>
        </CardHeader>
        <CardContent>
          <AttendanceEditForm
            employeeId={employeeId}
            employeeName={employeeName}
            date={date}
            logs={logs || []}
            timezone={timezone}
            userRole={profile.role}
            wasCapped={wasCapped}
          />
        </CardContent>
      </Card>
    </div>
  );
}
