import { createClient } from '@/lib/supabase/server'
import { format, startOfDay, isSameDay, parseISO } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'
import { Database } from '@/lib/supabase/database.types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { redirect } from 'next/navigation'

// Type for processed, aggregated report row
type ReportRow = {
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  totalHours: number;
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

// Helper function to calculate duration in seconds
function calculateDuration(startIso: string, endIso: string): number {
  const startTime = parseISO(startIso).getTime();
  const endTime = parseISO(endIso).getTime();
  return endTime > startTime ? (endTime - startTime) / 1000 : 0;
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
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || (profile?.role !== 'manager' && profile?.role !== 'admin')) {
    return redirect('/?message=Unauthorized access') // Redirect non-managers
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

  // --- Get Employees for Filter Dropdown ---
  const { data: employeesData, error: employeesError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .order('full_name')

  if (employeesError) {
    console.error('Error fetching employees:', employeesError)
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
          entries: []
        };
      }

      // Add the signin entry
      const currentRow = reportData[reportDate][employeeId];
      const entryIndex = currentRow.entries.length;

      currentRow.entries.push({
        in: log.timestamp,
        out: null
      });

      // Track this open signin
      openSignins[employeeId] = {
        log,
        entryIndex,
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

        // Update the entry with the signout time
        currentRow.entries[entryIndex].out = log.timestamp;

        // Calculate hours for this entry
        const duration = calculateDuration(
          openSignin.log.timestamp,
          log.timestamp
        );

        currentRow.totalHours += duration / 3600; // Convert seconds to hours

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

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Attendance Reports</h1>

      {/* Filters */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
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
                  <SelectValue placeholder="Select employee" />
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
              <Button type="submit" className="w-full">Apply Filters</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Report Table */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance Report</CardTitle>
        </CardHeader>
        <CardContent>
          {reportRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Employee</th>
                    <th className="px-4 py-2 text-left">Hours</th>
                    <th className="px-4 py-2 text-left">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {reportRows.map((row, index) => (
                    <tr key={`${row.date}-${row.employeeId}`} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                      <td className="px-4 py-3 border-t">
                        {format(new Date(row.date), 'MMM d, yyyy')}
                        <span className="ml-2 text-xs text-primary">({timezone.replace(/_/g, ' ')})</span>
                      </td>
                      <td className="px-4 py-3 border-t">{row.employeeName}</td>
                      <td className="px-4 py-3 border-t font-medium">
                        {formatDuration(row.totalHours * 3600)}
                      </td>
                      <td className="px-4 py-3 border-t">
                        <div className="space-y-2">
                          {row.entries.map((entry, i) => (
                            <div key={i} className="text-sm">
                              {entry.in && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-500/10 text-green-600 mr-2">
                                  In: {formatInTimeZone(parseISO(entry.in), timezone, 'h:mm a')}
                                </span>
                              )}
                              {entry.out && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-500/10 text-red-600 mr-2">
                                  Out: {formatInTimeZone(parseISO(entry.out), timezone, 'h:mm a')}
                                </span>
                              )}
                              {entry.breakStart && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-amber-500/10 text-amber-600 mr-2">
                                  Break: {formatInTimeZone(parseISO(entry.breakStart), timezone, 'h:mm a')}
                                </span>
                              )}
                              {entry.breakEnd && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-500/10 text-blue-600">
                                  Return: {formatInTimeZone(parseISO(entry.breakEnd), timezone, 'h:mm a')}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No attendance data found for the selected filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
