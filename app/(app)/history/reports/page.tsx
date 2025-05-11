import { createClient } from '@/lib/supabase/server'
import { format, parseISO } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AttendanceReportCard from '@/components/AttendanceReportCard'

// Type for processed, aggregated report row
type ReportRow = {
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  totalHours: number;
  entries: {
    in: string | null;
    out: string | null;
    breakStart?: string | null;
    breakEnd?: string | null;
  }[]; // Timestamps for each entry
};

// Type for the raw log data fetched from Supabase
type FetchedLog = {
  id: string;
  timestamp: string;
  event_type: string;
  user_id: string;
  created_at: string;
  profiles: {
    full_name: string | null;
  } | null;
};

interface EmployeeReportsPageProps {
  searchParams?: {
    startDate?: string;
    endDate?: string;
  };
}

// Helper function to calculate duration in seconds
function calculateDuration(startIso: string, endIso: string): number {
  const startTime = parseISO(startIso).getTime();
  const endTime = parseISO(endIso).getTime();
  return endTime > startTime ? (endTime - startTime) / 1000 : 0;
}

export default async function EmployeeReportsPage({ searchParams }: EmployeeReportsPageProps) {
  const supabase = await createClient()
  const awaitedSearchParams = await searchParams;

  // --- Authorization Check ---
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return redirect('/login?message=Unauthorized')
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

  // --- Get User Profile ---
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Error fetching user profile:', profileError);
  }

  const employeeName = profile?.full_name || 'Your';

  // --- Get Filter Values ---
  const startDate = awaitedSearchParams?.startDate; // e.g., '2024-07-01'
  const endDate = awaitedSearchParams?.endDate;     // e.g., '2024-07-31'

  // --- Fetch Filtered Logs ---
  let query = supabase
    .from('attendance_logs')
    .select('*, profiles(full_name)') // Join with profiles to get name
    .eq('user_id', user.id)
    .order('timestamp', { ascending: true });

  if (startDate) {
    // Ensure time part doesn't exclude start day
    query = query.gte('timestamp', startDate + 'T00:00:00.000Z');
  }

  if (endDate) {
    // Ensure time part includes end day
    query = query.lte('timestamp', endDate + 'T23:59:59.999Z');
  }

  const { data: logs, error: logsError } = await query;

  if (logsError) {
    console.error('Error fetching logs:', logsError);
  }

  // --- Process Logs into Report Format ---
  const reportData: Record<string, ReportRow> = {};

  // First, sort logs by timestamp to ensure chronological processing
  const sortedLogs = logs?.sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  ) || [];

  // Track open signin events
  let openSignin: { log: FetchedLog, entryIndex: number, reportDate: string } | null = null;

  // Helper function to format date in the specified timezone
  const formatDateInTimezone = (date: Date): string => {
    try {
      return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
    } catch (error) {
      console.error("Error formatting date in timezone:", error);
      return format(date, 'yyyy-MM-dd'); // Fallback to UTC
    }
  };

  // Process all logs
  sortedLogs.forEach((log: FetchedLog) => {
    const timestamp = parseISO(log.timestamp);
    const employeeId = log.user_id;
    const employeeName = log.profiles?.full_name || 'You';

    if (log.event_type === 'signin') {
      // For signin events, this is the date we'll attribute the shift to
      const reportDate = formatDateInTimezone(timestamp);

      // Initialize report row if it doesn't exist
      if (!reportData[reportDate]) {
        reportData[reportDate] = {
          employeeId,
          employeeName,
          date: reportDate,
          totalHours: 0,
          entries: []
        };
      }

      // Get the current entry index
      const entryIndex = reportData[reportDate].entries.length;

      // Initialize the new entry
      reportData[reportDate].entries.push({
        in: log.timestamp,
        out: null,
        breakStart: null,
        breakEnd: null
      });

      // Track this new signin
      openSignin = {
        log,
        entryIndex,
        reportDate
      };

    } else if (log.event_type === 'signout' && openSignin) {
      // For signout, use the date from the signin for reporting
      const reportDate = openSignin.reportDate;
      const reportRow = reportData[reportDate];
      const entryIndex = openSignin.entryIndex;

      // Update the existing entry with the signout time
      reportRow.entries[entryIndex].out = log.timestamp;

      // Calculate duration
      const duration = calculateDuration(openSignin.log.timestamp, log.timestamp);
      reportRow.totalHours += duration;

      // Clear the open signin
      openSignin = null;

    } else if ((log.event_type === 'break_start' || log.event_type === 'break_end') && openSignin) {
      // For break events, add them to the current entry
      const reportDate = openSignin.reportDate;
      const reportRow = reportData[reportDate];
      const entryIndex = openSignin.entryIndex;

      if (log.event_type === 'break_start') {
        reportRow.entries[entryIndex].breakStart = log.timestamp;
      } else { // break_end
        reportRow.entries[entryIndex].breakEnd = log.timestamp;
      }
    }
  });

  // Convert to array and sort by date (newest first)
  const reportRows = Object.values(reportData).sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="container mx-auto px-4 py-6 space-y-8 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{employeeName} Attendance Report</h1>
          <p className="text-muted-foreground mt-1">View your detailed attendance data</p>
        </div>
        <Link href="/history">
          <Button
            variant="outline"
            className="bg-card/70 hover:bg-primary/10 border-border/50 text-foreground transition-colors flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to History
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
          <form method="GET" action="/history/reports" className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Date Range Filter */}
            <div className="space-y-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" name="startDate" type="date" defaultValue={startDate || ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" name="endDate" type="date" defaultValue={endDate || ''} />
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
            reportRows.map((row) => {
              const dateObj = parseISO(row.date + 'T00:00:00');

              return (
                <div key={`date-group-${row.date}`} className="mb-8">
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

                  {/* Employee Card */}
                  <AttendanceReportCard
                    employeeName={row.employeeName}
                    employeeId={row.employeeId}
                    totalHours={row.totalHours}
                    entries={row.entries}
                    timezone={timezone}
                    date={row.date}
                    canEdit={false} // Regular employees can't edit their own records
                    currentUserId={user.id}
                  />
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
        </div>
      </div>
    </div>
  );
}
