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
  
  // Group logs by date and employee
  logs?.forEach((log: FetchedLog) => {
    const date = format(parseISO(log.timestamp), 'yyyy-MM-dd');
    const employeeId = log.user_id;
    const employeeName = log.profiles?.full_name || 'Unknown';
    
    // Initialize date group if it doesn't exist
    if (!reportData[date]) {
      reportData[date] = {};
    }
    
    // Initialize employee in date group if they don't exist
    if (!reportData[date][employeeId]) {
      reportData[date][employeeId] = {
        employeeId,
        employeeName,
        date,
        totalHours: 0,
        entries: []
      };
    }
    
    // Process log based on event type
    const currentRow = reportData[date][employeeId];
    
    if (log.event_type === 'signin') {
      // Start a new entry pair
      currentRow.entries.push({ 
        in: log.timestamp, 
        out: null 
      });
    } else if (log.event_type === 'signout') {
      // Find the last entry without an out time
      const lastEntryIndex = currentRow.entries.length - 1;
      if (lastEntryIndex >= 0 && currentRow.entries[lastEntryIndex].in && !currentRow.entries[lastEntryIndex].out) {
        currentRow.entries[lastEntryIndex].out = log.timestamp;
        
        // Calculate hours for this entry
        const duration = calculateDuration(
          currentRow.entries[lastEntryIndex].in!,
          log.timestamp
        );
        currentRow.totalHours += duration / 3600; // Convert seconds to hours
      } else {
        // Orphaned signout, create a new entry
        currentRow.entries.push({ 
          in: null, 
          out: log.timestamp 
        });
      }
    } else if (log.event_type === 'break_start') {
      // Find the current entry and add break start
      const lastEntryIndex = currentRow.entries.length - 1;
      if (lastEntryIndex >= 0 && currentRow.entries[lastEntryIndex].in && !currentRow.entries[lastEntryIndex].out) {
        currentRow.entries[lastEntryIndex].breakStart = log.timestamp;
      }
    } else if (log.event_type === 'break_end') {
      // Find the current entry and add break end
      const lastEntryIndex = currentRow.entries.length - 1;
      if (lastEntryIndex >= 0 && currentRow.entries[lastEntryIndex].in && !currentRow.entries[lastEntryIndex].out) {
        currentRow.entries[lastEntryIndex].breakEnd = log.timestamp;
      }
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
                      <td className="px-4 py-3 border-t">{format(new Date(row.date), 'MMM d, yyyy')}</td>
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
                                  In: {format(new Date(entry.in), 'h:mm a')}
                                </span>
                              )}
                              {entry.out && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-500/10 text-red-600 mr-2">
                                  Out: {format(new Date(entry.out), 'h:mm a')}
                                </span>
                              )}
                              {entry.breakStart && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-amber-500/10 text-amber-600 mr-2">
                                  Break: {format(new Date(entry.breakStart), 'h:mm a')}
                                </span>
                              )}
                              {entry.breakEnd && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-500/10 text-blue-600">
                                  Return: {format(new Date(entry.breakEnd), 'h:mm a')}
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
