import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
// import { DateRangePicker } from '@/components/ui/date-range-picker' // Assuming you have this
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Database } from '@/lib/supabase/database.types'
import { format, startOfDay, isSameDay, parseISO } from 'date-fns';

// Placeholder type for report data
type ReportData = {
  employeeId: string; // Added ID for potential linking
  employeeName: string;
  date: string;
  totalHours: number;
  // Add other relevant fields
};

// Define Profile type
type Profile = Database['public']['Tables']['profiles']['Row'];

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
function aggregateLogs(logs: FetchedLog[]): ReportRow[] {
  if (!logs || logs.length === 0) return [];

  const reportMap = new Map<string, ReportRow>(); // Key: employeeId-date

  // Sort logs primarily by user, then by timestamp ASCENDING for pairing
  const sortedLogs = [...logs].sort((a, b) => {
    if (a.user_id < b.user_id) return -1;
    if (a.user_id > b.user_id) return 1;
    // Handle potential null timestamps defensively, though unlikely based on schema
    return parseISO(a.timestamp ?? '1970-01-01T00:00:00Z').getTime() - parseISO(b.timestamp ?? '1970-01-01T00:00:00Z').getTime();
  });

  let lastSignIn: FetchedLog | null = null; // Use FetchedLog type

  for (const log of sortedLogs) {
    if (!log.timestamp) continue; // Skip logs with null timestamps

    const logDate = format(startOfDay(parseISO(log.timestamp)), 'yyyy-MM-dd');
    const mapKey = `${log.user_id}-${logDate}`;

    // Initialize report row if it doesn't exist
    if (!reportMap.has(mapKey)) {
      reportMap.set(mapKey, {
        employeeId: log.user_id,
        employeeName: log.profiles?.full_name || 'Unknown User',
        date: logDate,
        totalHours: 0,
        entries: [],
      });
    }
    const reportRow = reportMap.get(mapKey)!;

    if (log.event_type === 'signin') {
      if (lastSignIn && lastSignIn.user_id === log.user_id) {
         if (!lastSignIn.timestamp) continue; // Defensive check
         const lastSignInDate = format(startOfDay(parseISO(lastSignIn.timestamp)), 'yyyy-MM-dd');
         const lastSignInKey = `${lastSignIn.user_id}-${lastSignInDate}`;
         if(reportMap.has(lastSignInKey)) {
             reportMap.get(lastSignInKey)!.entries.push({ in: lastSignIn.timestamp, out: null });
         }
      }
      lastSignIn = log; 
    } else if (log.event_type === 'signout') {
      if (lastSignIn && 
          lastSignIn.user_id === log.user_id && 
          lastSignIn.timestamp && // Ensure last sign-in timestamp exists
          isSameDay(parseISO(lastSignIn.timestamp), parseISO(log.timestamp)))
      {
        const duration = calculateDuration(lastSignIn.timestamp, log.timestamp);
        reportRow.totalHours += duration;
        reportRow.entries.push({ in: lastSignIn.timestamp, out: log.timestamp });
        lastSignIn = null; 
      } else {
        reportRow.entries.push({ in: null, out: log.timestamp });
        lastSignIn = null; 
      }
    } else {
        lastSignIn = null; 
    }
  }

  if (lastSignIn && lastSignIn.timestamp) { // Check timestamp before using
     const lastSignInDate = format(startOfDay(parseISO(lastSignIn.timestamp)), 'yyyy-MM-dd');
     const lastSignInKey = `${lastSignIn.user_id}-${lastSignInDate}`;
     if(reportMap.has(lastSignInKey)) {
        reportMap.get(lastSignInKey)!.entries.push({ in: lastSignIn.timestamp, out: null });
     }
  }

  // Convert map values to array and sort by date descending, then name
  return Array.from(reportMap.values()).sort((a, b) => {
    if (a.date > b.date) return -1;
    if (a.date < b.date) return 1;
    if (a.employeeName < b.employeeName) return -1;
    if (a.employeeName > b.employeeName) return 1;
    return 0;
  });
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
          aggregatedReportData = aggregateLogs(logsData as FetchedLog[]);
      } catch (aggError) {
          console.error("Error aggregating report data:", aggError);
          // Maybe set a specific error message for the UI
          // aggregatedReportData = []; // Keep it empty on error
      }
  } 

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Attendance Reports</h1>
        <Link href="/admin">
          <Button variant="outline">Back to Admin</Button>
        </Link>
      </div>

      {/* Filters Card - Use a Form for GET request */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
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
              <Button type="submit">Apply Filters</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Report Results Card */} 
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Report Results</CardTitle>
          <Button variant="outline" disabled>Export Report (CSV)</Button> {/* Placeholder Button */}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  {/* Updated columns for aggregated data */}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Hours</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Entries (In/Out)</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logsError ? (
                    <tr><td colSpan={4} className="px-6 py-4 text-center text-red-500">Error loading data: {logsError.message}</td></tr>
                ) : aggregatedReportData.length > 0 ? (
                  aggregatedReportData.map((row, index) => (
                    <tr key={`${row.employeeId}-${row.date}-${index}`}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{row.employeeName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{format(parseISO(row.date + 'T00:00:00'), 'PP')}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{(row.totalHours / 3600).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs">
                        {row.entries.map((entry, idx) => (
                          <div key={idx} className={idx > 0 ? 'mt-1' : ''}>
                            In: {entry.in ? format(parseISO(entry.in), 'p') : '--'}
                            {' '}| Out: {entry.out ? format(parseISO(entry.out), 'p') : <span className='text-orange-500'>--</span>}
                          </div>
                        ))}
                        {row.entries.length === 0 && <span className='text-gray-400'>No pairs</span>}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-gray-500">No data matching filters or no completed sign-in/out pairs found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
} 