import { createClient } from '@/lib/supabase/server'
import { format, startOfDay, isSameDay, parseISO } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { Database } from '@/lib/supabase/database.types'
import { capShiftDuration, formatDuration as formatDurationUtil } from '@/lib/shift-utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { redirect } from 'next/navigation'
import AttendanceReportCard from '@/components/AttendanceReportCard'
import Link from 'next/link'

// Type for processed, aggregated report row
type ReportRow = {
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  totalHours: number;
  wasCapped?: boolean; // Indicates if the shift duration was capped
  entries: { in: string | null; out: string | null; breakStart?: string; breakEnd?: string }[]; // Timestamps for each entry
};

// Type for the raw log data fetched from Supabase
type FetchedLog = {
  id: string;
  timestamp: string;
  event_type: Database['public']['Enums']['attendance_event_type'];
  user_id: string;
  created_at: string;
  profiles: {
    full_name: string | null;
  } | null;
};

interface ManagerReportsPageProps {
  searchParams?: {
    startDate?: string;
    endDate?: string;
    employeeId?: string;
  };
}

// Helper function to calculate duration in seconds with capping for unreasonably long shifts
function calculateDuration(startIso: string, endIso: string): { duration: number, wasCapped: boolean } {
  const startTime = parseISO(startIso).getTime();
  const endTime = parseISO(endIso).getTime();

  if (endTime <= startTime) return { duration: 0, wasCapped: false };

  // Cap the duration if it's unreasonably long (e.g., if someone forgot to sign out)
  const { durationSeconds, wasCapped } = capShiftDuration(startTime, endTime);

  return { duration: durationSeconds, wasCapped };
}

// Helper function to format duration
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export default async function ManagerReportsPage({ searchParams }: ManagerReportsPageProps) {
  const supabase = await createClient()
  const awaitedSearchParams = await searchParams; // Await searchParams for Next.js 15+

  // --- Authorization Check ---
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return redirect('/login?message=Unauthorized')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role, department_id')
    .eq('id', user.id)
    .single()

  if (profileError || (profile?.role !== 'manager' && profile?.role !== 'admin')) {
    return redirect('/?message=Unauthorized access') // Redirect non-managers
  }

  // Store the current user's ID and department for later use
  const currentUserId = user.id;
  const managerDepartmentId = profile?.department_id;

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

  // --- Get Employees for Filter Dropdown ---
  // For managers, only show employees in their department
  let employeeQuery = supabase
    .from('profiles')
    .select('id, full_name, department_id, role, profile_picture_url')
    .order('full_name');

  // If user is a manager (not admin), filter by department
  if (profile?.role === 'manager' && managerDepartmentId) {
    employeeQuery = employeeQuery.eq('department_id', managerDepartmentId);
  }

  const { data: employeesData, error: employeesError } = await employeeQuery;

  if (employeesError) {
    console.error('Error fetching employees:', employeesError);
  }

  const employees = employeesData?.map(e => ({
    id: e.id,
    name: e.full_name || 'Unnamed User',
    department_id: e.department_id,
    role: e.role,
    profilePictureUrl: e.profile_picture_url
  })) || [];

  // --- Get Filter Values ---
  const startDate = awaitedSearchParams?.startDate; // e.g., '2024-07-01'
  const endDate = awaitedSearchParams?.endDate;     // e.g., '2024-07-31'
  const employeeId = awaitedSearchParams?.employeeId === 'all' || !awaitedSearchParams?.employeeId
                     ? null
                     : awaitedSearchParams.employeeId;

  // --- Fetch Filtered Logs ---
  let query = supabase
    .from('attendance_logs')
    .select('*, profiles(full_name)') // Join with profiles to get name
    .order('timestamp', { ascending: true });

  if (startDate) {
    // Ensure time part doesn't exclude start day
    query = query.gte('timestamp', startDate + 'T00:00:00.000Z');
  }

  if (endDate) {
    // Ensure time part includes end day
    query = query.lte('timestamp', endDate + 'T23:59:59.999Z');
  }

  if (employeeId) {
    query = query.eq('user_id', employeeId);
  }

  const { data: logs, error: logsError } = await query;

  if (logsError) {
    console.error('Error fetching logs:', logsError);
  }

  // --- Process Logs into Report Format ---
  const reportData: Record<string, Record<string, ReportRow>> = {};

  // First, sort logs by timestamp to ensure chronological processing
  const sortedLogs = logs?.sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  ) || [];

  // Track open signin events for each employee
  const openSignins: Record<string, { log: FetchedLog, entryIndex: number, reportDate: string }> = {};

  // Helper function to format date in the specified timezone
  const formatDateInTimezone = (date: Date): string => {
    try {
      return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
    } catch (error) {
      console.error("Error formatting date in timezone:", error);
      return format(date, 'yyyy-MM-dd'); // Fallback to UTC
    }
  };

  // Helper function to log timezone information for debugging
  const logTimezoneInfo = (label: string, timestamp: string) => {
    try {
      const date = parseISO(timestamp);
      console.log(`[${label}] Raw: ${timestamp}`);
      console.log(`[${label}] UTC: ${date.toISOString()}`);
      console.log(`[${label}] ${timezone}: ${formatInTimeZone(date, timezone, 'yyyy-MM-dd HH:mm:ss')}`);
    } catch (error) {
      console.error(`Error logging timezone info for ${label}:`, error);
    }
  };

  // Process all logs
  sortedLogs.forEach((log: FetchedLog) => {
    // For all event types, we use the date of the event for grouping
    const timestamp = parseISO(log.timestamp);
    const employeeId = log.user_id;
    const employeeName = log.profiles?.full_name || 'Unknown';

    if (log.event_type === 'signin') {
      // For signin events, this is the date we'll attribute the shift to
      const reportDate = formatDateInTimezone(timestamp);

      // Initialize date group if it doesn't exist
      if (!reportData[reportDate]) {
        reportData[reportDate] = {};
      }

      // Initialize employee in date group if they don't exist
      if (!reportData[reportDate][employeeId]) {
        reportData[reportDate][employeeId] = {
          employeeId,
          employeeName,
          date: reportDate,
          totalHours: 0,
          wasCapped: false,
          entries: []
        };
      }

      // Add the signin entry
      const currentRow = reportData[reportDate][employeeId];
      const entryIndex = currentRow.entries.length;

      // Log timezone information for debugging
      logTimezoneInfo('Signin', log.timestamp);

      // Check if there's already an entry for this employee on this date
      const existingEntries = currentRow.entries;
      const existingEntry = existingEntries.length > 0 ? existingEntries[existingEntries.length - 1] : null;

      if (existingEntry && existingEntry.out === null) {
        // If there's an existing entry with no signout, update it with the latest signin
        console.log(`[Manager Reports] Updating existing signin for ${employeeId} on ${reportDate} from ${existingEntry.in} to ${log.timestamp}`);
        existingEntry.in = log.timestamp;
      } else {
        // Otherwise, create a new entry
        console.log(`[Manager Reports] Creating new signin entry for ${employeeId} on ${reportDate}: ${log.timestamp}`);
        currentRow.entries.push({
          in: log.timestamp,
          out: null
        });
      }

      // Track this open signin with the correct entry index
      const updatedEntryIndex = existingEntry && existingEntry.out === null
        ? existingEntries.indexOf(existingEntry)
        : currentRow.entries.length - 1;

      openSignins[employeeId] = {
        log,
        entryIndex: updatedEntryIndex,
        reportDate
      };

    } else if (log.event_type === 'signout') {
      // For signout, find the matching signin regardless of date
      const openSignin = openSignins[employeeId];

      if (openSignin) {
        // We have a matching signin - use the date from the signin for reporting
        const reportDate = openSignin.reportDate;
        const currentRow = reportData[reportDate][employeeId];
        const entryIndex = openSignin.entryIndex;

        // Log timezone information for debugging
        logTimezoneInfo('Signout', log.timestamp);

        // Update the entry with the signout time
        currentRow.entries[entryIndex].out = log.timestamp;

        // Calculate hours for this entry
        const { duration, wasCapped } = calculateDuration(
          openSignin.log.timestamp,
          log.timestamp
        );

        currentRow.totalHours += duration / 3600; // Convert seconds to hours

        // Store whether this shift was capped
        if (wasCapped) {
          currentRow.wasCapped = true;
        }

        // Clear the open signin
        delete openSignins[employeeId];
      } else {
        // Orphaned signout - create an entry on the date of the signout
        const reportDate = formatDateInTimezone(timestamp);

        // Initialize date group if it doesn't exist
        if (!reportData[reportDate]) {
          reportData[reportDate] = {};
        }

        // Initialize employee in date group if they don't exist
        if (!reportData[reportDate][employeeId]) {
          reportData[reportDate][employeeId] = {
            employeeId,
            employeeName,
            date: reportDate,
            totalHours: 0,
            wasCapped: false,
            entries: []
          };
        }

        // Add the orphaned signout
        reportData[reportDate][employeeId].entries.push({
          in: null,
          out: log.timestamp
        });
      }
    } else if (log.event_type === 'break_start' || log.event_type === 'break_end') {
      // For break events, find the open signin for this employee
      const openSignin = openSignins[employeeId];

      if (openSignin) {
        // We have an open shift - add the break event to it
        const reportDate = openSignin.reportDate;
        const currentRow = reportData[reportDate][employeeId];
        const entryIndex = openSignin.entryIndex;

        if (log.event_type === 'break_start') {
          currentRow.entries[entryIndex].breakStart = log.timestamp;
        } else { // break_end
          currentRow.entries[entryIndex].breakEnd = log.timestamp;
        }
      }
      // If no open signin, we ignore the break event
    }
  });

  // Convert to array and sort by date (newest first) then by employee name
  const reportRows = Object.values(reportData)
    .flatMap(dateGroup => Object.values(dateGroup))
    .sort((a, b) => {
      // Sort by date (descending)
      const dateComparison = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateComparison !== 0) return dateComparison;

      // Then by employee name (ascending)
      return a.employeeName.localeCompare(b.employeeName);
    });

  // Group report rows by date
  const groupedByDate = reportRows.reduce((acc, row) => {
    if (!acc[row.date]) {
      acc[row.date] = [];
    }
    acc[row.date].push(row);
    return acc;
  }, {} as Record<string, ReportRow[]>);

  // Get sorted dates (newest first)
  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  return (
    <div className="container mx-auto px-4 py-6 space-y-8 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Attendance Reports</h1>
          <p className="text-muted-foreground mt-1">View employee attendance data</p>
        </div>
        <Link href="/mgmt">
          <Button
            variant="outline"
            className="bg-card/70 hover:bg-primary/10 border-border/50 text-foreground transition-colors flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to Manager Dashboard
          </Button>
        </Link>
      </div>

      {/* Filters Card */}
      <Card className="bg-card/70 dark:bg-card/70 backdrop-blur-md border border-white/10 rounded-xl shadow-lg transition-all duration-300 hover:shadow-xl">
        <CardHeader className="flex flex-row items-center space-y-0 pb-2">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
            </svg>
            <CardTitle>Filter Reports</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form method="GET" action="/mgmt/reports" className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Date Range Filter */}
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" name="startDate" type="date" defaultValue={startDate || ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" name="endDate" type="date" defaultValue={endDate || ''} />
            </div>

            {/* Employee Filter */}
            <div className="space-y-2">
              <Label htmlFor="employeeId">Employee</Label>
              <Select name="employeeId" defaultValue={employeeId || 'all'}>
                <SelectTrigger id="employeeId">
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Submit Button */}
            <div className="flex items-end">
              <Button
                type="submit"
                className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors w-full"
              >
                Apply Filters
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Report Results */}
      <div className="space-y-4">
        <div className="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
            <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
          </svg>
          <h2 className="text-xl font-semibold text-foreground">Attendance Report</h2>
        </div>

        <div className="bg-card/70 dark:bg-card/70 backdrop-blur-md border border-white/10 overflow-hidden shadow-lg rounded-xl p-6 transition-all duration-300 hover:shadow-xl">
          {logsError ? (
            <div className="text-center text-destructive p-6">
              Error loading data: {logsError.message}
            </div>
          ) : reportRows.length > 0 ? (
            sortedDates.map((date) => {
              const rows = groupedByDate[date];
              const dateObj = parseISO(date + 'T00:00:00');

              return (
                <div key={`date-group-${date}`} className="mb-8">
                  {/* Date Header */}
                  <div className="flex items-center mb-4 pb-2 border-b border-border/30">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div>
                      <span className="font-semibold text-foreground">
                        {formatInTimeZone(dateObj, timezone, 'EEEE')}
                      </span>
                      <span className="ml-2 text-sm text-muted-foreground">
                        {formatInTimeZone(dateObj, timezone, 'MMMM d, yyyy')}
                      </span>
                      <span className="ml-2 text-xs text-primary">
                        ({timezone.replace(/_/g, ' ')})
                      </span>
                    </div>
                  </div>

                  {/* Employee Cards for this date */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {rows.map((row) => {
                      // Determine if this employee can be edited by the current manager
                      // Managers can edit employees in their department, but not themselves
                      const isCurrentUser = row.employeeId === currentUserId;
                      const isAdmin = profile?.role === 'admin';

                      // Find employee details from the employees array
                      const employeeDetails = employees.find(e => e.id === row.employeeId);
                      const isInManagerDepartment = employeeDetails?.department_id === managerDepartmentId;

                      // Can edit if admin, or if manager and employee is in their department and not themselves
                      const canEdit = isAdmin || (isInManagerDepartment && !isCurrentUser);

                      return (
                        <AttendanceReportCard
                          key={`${row.employeeId}-${row.date}`}
                          employeeName={row.employeeName}
                          employeeId={row.employeeId}
                          totalHours={row.totalHours * 3600} // Convert hours to seconds for consistent formatting
                          entries={row.entries}
                          timezone={timezone}
                          date={row.date}
                          canEdit={canEdit}
                          currentUserId={currentUserId}
                          wasCapped={row.wasCapped}
                          profilePictureUrl={employees.find(e => e.id === row.employeeId)?.profilePictureUrl}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="bg-muted/20 p-4 rounded-full mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-muted-foreground">No data matching filters or no completed sign-in/out pairs found.</p>
              <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters</p>
            </div>
          )}

          <div className="flex items-center justify-center mt-6 pt-4 border-t border-border/30 text-muted-foreground text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted-foreground mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Attendance report grouped by date with employee time records
          </div>
        </div>
      </div>
    </div>
  )
}
