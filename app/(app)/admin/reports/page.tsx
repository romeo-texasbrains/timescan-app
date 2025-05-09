import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
// import { DateRangePicker } from '@/components/ui/date-range-picker' // Assuming you have this
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Database } from '@/lib/supabase/database.types'
import { format, startOfDay, isSameDay, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

// Type for processed, aggregated report row
type ReportRow = {
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  totalHours: number;
  entries: { in: string | null; out: string | null }[]; // Timestamps for each entry
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

interface AdminReportsPageProps {
  searchParams?: {
    startDate?: string;
    endDate?: string;
    employeeId?: string;
  };
}

// Helper function to calculate duration in seconds
function calculateDuration(startIso: string, endIso: string): number {
  const startTime = parseISO(startIso).getTime();
  const endTime = parseISO(endIso).getTime();
  return endTime > startTime ? (endTime - startTime) / 1000 : 0;
}

// Helper function to aggregate logs into report rows
function aggregateLogs(logs: FetchedLog[], timezone: string): ReportRow[] {
  if (!logs || logs.length === 0) return [];

  const reportMap = new Map<string, ReportRow>(); // Key: employeeId-date

  // Sort logs chronologically to ensure proper pairing
  const sortedLogs = [...logs].sort((a, b) => {
    return parseISO(a.timestamp ?? '1970-01-01T00:00:00Z').getTime() -
           parseISO(b.timestamp ?? '1970-01-01T00:00:00Z').getTime();
  });

  // Track open signin events for each employee
  const openSignins: Record<string, { log: FetchedLog, reportDate: string }> = {};

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
  for (const log of sortedLogs) {
    if (!log.timestamp) continue; // Skip logs with null timestamps

    const timestamp = parseISO(log.timestamp);
    const employeeId = log.user_id;
    const employeeName = log.profiles?.full_name || 'Unknown User';

    if (log.event_type === 'signin') {
      // For signin events, this is the date we'll attribute the shift to
      // Use timezone-aware date formatting
      const reportDate = formatDateInTimezone(timestamp);

      // Initialize report row if it doesn't exist
      const mapKey = `${employeeId}-${reportDate}`;
      if (!reportMap.has(mapKey)) {
        reportMap.set(mapKey, {
          employeeId,
          employeeName,
          date: reportDate,
          totalHours: 0,
          entries: [],
        });
      }

      // If there's already an open signin for this employee, close it as incomplete
      if (openSignins[employeeId]) {
        const prevSignin = openSignins[employeeId];
        const prevMapKey = `${employeeId}-${prevSignin.reportDate}`;
        if (reportMap.has(prevMapKey)) {
          reportMap.get(prevMapKey)!.entries.push({
            in: prevSignin.log.timestamp,
            out: null
          });
        }
      }

      // Track this new signin
      openSignins[employeeId] = {
        log,
        reportDate
      };

    } else if (log.event_type === 'signout') {
      // For signout, find the matching signin regardless of date
      const openSignin = openSignins[employeeId];

      if (openSignin && openSignin.log.timestamp) {
        // We have a matching signin - use the date from the signin for reporting
        const reportDate = openSignin.reportDate;
        const mapKey = `${employeeId}-${reportDate}`;

        // Initialize report row if it doesn't exist (shouldn't happen but just in case)
        if (!reportMap.has(mapKey)) {
          reportMap.set(mapKey, {
            employeeId,
            employeeName,
            date: reportDate,
            totalHours: 0,
            entries: [],
          });
        }

        const reportRow = reportMap.get(mapKey)!;

        // Calculate duration and add the entry
        const duration = calculateDuration(openSignin.log.timestamp, log.timestamp);
        reportRow.totalHours += duration;
        reportRow.entries.push({
          in: openSignin.log.timestamp,
          out: log.timestamp
        });

        // Clear the open signin
        delete openSignins[employeeId];
      } else {
        // Orphaned signout - create an entry on the date of the signout
        // Use timezone-aware date formatting
        const reportDate = formatDateInTimezone(timestamp);
        const mapKey = `${employeeId}-${reportDate}`;

        // Initialize report row if it doesn't exist
        if (!reportMap.has(mapKey)) {
          reportMap.set(mapKey, {
            employeeId,
            employeeName,
            date: reportDate,
            totalHours: 0,
            entries: [],
          });
        }

        // Add the orphaned signout
        reportMap.get(mapKey)!.entries.push({
          in: null,
          out: log.timestamp
        });
      }
    } else {
      // For other event types (like break_start, break_end), we ignore them in this report
      // They could be handled separately if needed
    }
  }

  // Add any remaining open signins as incomplete entries
  Object.values(openSignins).forEach(({ log, reportDate }) => {
    if (!log.timestamp) return; // Skip if no timestamp

    const mapKey = `${log.user_id}-${reportDate}`;
    if (reportMap.has(mapKey)) {
      reportMap.get(mapKey)!.entries.push({
        in: log.timestamp,
        out: null
      });
    }
  });

  // Convert map values to array and sort by date descending, then name
  const sortedData = Array.from(reportMap.values()).sort((a, b) => {
    if (a.date > b.date) return -1;
    if (a.date < b.date) return 1;
    if (a.employeeName < b.employeeName) return -1;
    if (a.employeeName > b.employeeName) return 1;
    return 0;
  });

  return sortedData;
}

export default async function AdminReportsPage({ searchParams }: AdminReportsPageProps) {
  const supabase = await createClient()
  const awaitedSearchParams = await searchParams; // No need to await searchParams object itself

  // --- Authorization Check ---
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return redirect('/login?message=Unauthorized')
  }
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || profile?.role !== 'admin') {
    return redirect('/?message=Unauthorized access') // Redirect non-admins
  }
  // -------------------------

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

  // Fetch data for filters (list of employees)
  const { data: employeesData, error: employeesError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .order('full_name', { ascending: true });

  if (employeesError) {
    console.error("Error fetching employees for filter:", employeesError);
    // Handle error appropriately - maybe show an error message and disable filter
  }
  const employees = employeesData?.map(e => ({ id: e.id, name: e.full_name || 'Unnamed User' })) || [];

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
    .order('timestamp', { ascending: false });

  if (startDate) {
    // Ensure time part doesn't exclude start day
    query = query.gte('timestamp', startDate + 'T00:00:00.000Z');
  }
  if (endDate) {
    // Ensure time part includes the whole end day
    query = query.lte('timestamp', endDate + 'T23:59:59.999Z');
  }
  if (employeeId) {
    query = query.eq('user_id', employeeId);
  }

  // Add a reasonable limit for now, maybe remove later or make configurable
  query = query.limit(500);

  const { data: logsData, error: logsError } = await query;

  // --- Process and Aggregate Logs ---
  let aggregatedReportData: ReportRow[] = [];
  if (!logsError && logsData) {
      try {
          // Cast logsData to the specific type before passing
          aggregatedReportData = aggregateLogs(logsData as FetchedLog[], timezone);
      } catch (aggError) {
          console.error("Error aggregating report data:", aggError);
          // Maybe set a specific error message for the UI
          // aggregatedReportData = []; // Keep it empty on error
      }
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-8 text-foreground">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Attendance Reports</h1>
          <p className="text-muted-foreground mt-1">View and export employee attendance data</p>
        </div>
        <Link href="/admin">
          <Button
            variant="outline"
            className="bg-card/70 hover:bg-primary/10 border-border/50 text-foreground transition-colors flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to Admin
          </Button>
        </Link>
      </div>

      {/* Filters Card - Use a Form for GET request */}
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
          {/* Wrap filters in a form that uses GET method */}
          <form method="GET" action="/admin/reports" className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Date Range Filter (using simple date inputs) */}
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
                  {employeesError ? (
                    <SelectItem value="error" disabled>Error loading employees</SelectItem>
                  ) : (
                    employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                type="submit"
                className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Apply Filters
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Report Results Card */}
      <div className="space-y-4">
        <div className="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
            <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
          </svg>
          <h2 className="text-xl font-semibold text-foreground">Report Results</h2>
          <div className="ml-auto">
            <Button
              variant="outline"
              disabled
              className="bg-card/70 hover:bg-primary/10 border-border/50 text-foreground transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Report (CSV)
            </Button>
          </div>
        </div>

        <div className="bg-card/70 dark:bg-card/70 backdrop-blur-md border border-white/10 overflow-hidden shadow-lg rounded-xl transition-all duration-300 hover:shadow-xl">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-primary/10">
                <TableRow className="border-b border-border/30">
                  <TableHead className="py-4 px-6 text-sm font-semibold text-foreground uppercase tracking-wider">Employee</TableHead>
                  <TableHead className="py-4 px-6 text-sm font-semibold text-foreground uppercase tracking-wider text-center">Hours</TableHead>
                  <TableHead className="py-4 px-6 text-sm font-semibold text-foreground uppercase tracking-wider">Entries (In/Out)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logsError ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-destructive">
                      Error loading data: {logsError.message}
                    </TableCell>
                  </TableRow>
                ) : aggregatedReportData.length > 0 ? (
                  (() => {
                    // Group data by date
                    const groupedByDate = aggregatedReportData.reduce((acc, row) => {
                      if (!acc[row.date]) {
                        acc[row.date] = [];
                      }
                      acc[row.date].push(row);
                      return acc;
                    }, {} as Record<string, ReportRow[]>);

                    // Get sorted dates (already sorted in aggregateLogs)
                    const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

                    // Render grouped data
                    return sortedDates.map((date, dateIndex) => {
                      const rows = groupedByDate[date];
                      const dateObj = parseISO(date + 'T00:00:00');

                      return (
                        <React.Fragment key={`date-group-${date}`}>
                          {/* Date Header Row */}
                          <TableRow className="bg-primary/20 border-t border-b border-border/30">
                            <TableCell colSpan={3} className="py-3 px-6">
                              <div className="flex items-center">
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
                            </TableCell>
                          </TableRow>

                          {/* Employee Rows for this date */}
                          {rows.map((row, rowIndex) => (
                            <TableRow
                              key={`${row.employeeId}-${row.date}-${rowIndex}`}
                              className={`border-b border-border/20 transition-colors ${rowIndex % 2 === 0 ? 'bg-transparent' : 'bg-primary/5'} hover:bg-primary/10`}
                            >
                              <TableCell className="py-4 px-6">
                                <div className="flex items-center">
                                  <div className="flex-shrink-0 h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                                    <span className="text-primary font-semibold text-sm">
                                      {row.employeeName.split(' ').map(n => n[0]).join('')}
                                    </span>
                                  </div>
                                  <div className="ml-4">
                                    <div className="text-sm font-medium text-foreground">{row.employeeName}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="py-4 px-6 text-center">
                                <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
                                  {(() => {
                                    // Convert seconds to hours and minutes
                                    const totalSeconds = row.totalHours;
                                    const hours = Math.floor(totalSeconds / 3600);
                                    const minutes = Math.floor((totalSeconds % 3600) / 60);

                                    // Format as "X hr Y min" or just "X hr" if minutes is 0
                                    return `${hours} hr${hours !== 1 ? 's' : ''} ${minutes > 0 ? `${minutes} min` : ''}`;
                                  })()}
                                </div>
                              </TableCell>
                              <TableCell className="py-4 px-6">
                                {row.entries.length > 0 ? (
                                  <div className="space-y-2">
                                    {row.entries.map((entry, idx) => (
                                      <div key={idx} className="flex items-center text-sm">
                                        <div className="flex-1 grid grid-cols-2 gap-2">
                                          <div className="flex items-center">
                                            <div className={`h-2 w-2 rounded-full mr-2 ${entry.in ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                                            <span className={entry.in ? 'text-foreground' : 'text-muted-foreground'}>
                                              {entry.in ? formatInTimeZone(parseISO(entry.in), timezone, 'h:mm a') : '--'}
                                            </span>
                                          </div>
                                          <div className="flex items-center">
                                            <div className={`h-2 w-2 rounded-full mr-2 ${entry.out ? 'bg-red-500' : 'bg-gray-300'}`}></div>
                                            <span className={entry.out ? 'text-foreground' : 'text-destructive/70'}>
                                              {entry.out ? formatInTimeZone(parseISO(entry.out), timezone, 'h:mm a') : 'Missing'}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="inline-block px-2 py-1 text-xs rounded bg-muted/50 text-muted-foreground">No entries</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </React.Fragment>
                      );
                    });
                  })()
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-12">
                      <div className="flex flex-col items-center justify-center">
                        <div className="bg-muted/20 p-4 rounded-full mb-4">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">No data matching filters or no completed sign-in/out pairs found.</p>
                        <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
              <TableCaption className="py-4 text-muted-foreground">
                <div className="flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted-foreground mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Attendance report grouped by date with employee time records
                </div>
              </TableCaption>
            </Table>
          </div>
        </div>
      </div>
    </div>
  )
}