import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'
import { Database } from '@/lib/supabase/database.types'

interface AdjustmentsPageProps {
  searchParams?: {
    employeeId?: string;
    date?: string;
  };
}

type AttendanceLog = Database['public']['Tables']['attendance_logs']['Row'] & {
  profiles?: {
    full_name: string | null;
  } | null;
};

export default async function ManagerAdjustmentsPage({ searchParams }: AdjustmentsPageProps) {
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
  const employeeId = awaitedSearchParams?.employeeId;
  const date = awaitedSearchParams?.date;

  // --- Fetch Filtered Logs ---
  let query = supabase
    .from('attendance_logs')
    .select('*, profiles(full_name)') // Join with profiles to get name
    .order('timestamp', { ascending: false });

  if (employeeId) {
    query = query.eq('user_id', employeeId);
  }

  if (date) {
    // Filter by date
    query = query.gte('timestamp', `${date}T00:00:00.000Z`)
                .lte('timestamp', `${date}T23:59:59.999Z`);
  }

  // Limit to 50 most recent logs if no filters applied
  if (!employeeId && !date) {
    query = query.limit(50);
  }

  const { data: logs, error: logsError } = await query;

  if (logsError) {
    console.error('Error fetching logs:', logsError);
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Attendance Adjustments</h1>

      {/* Filters */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="GET" action="/mgmt/adjustments" className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

            {/* Date Filter */}
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" name="date" type="date" defaultValue={date || ''} />
            </div>

            {/* Submit Button */}
            <div className="flex items-end">
              <Button type="submit" className="w-full">Apply Filters</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Add New Log Button */}
      <div className="flex justify-end mb-4">
        <Link href="/mgmt/adjustments/new">
          <Button>Add New Log</Button>
        </Link>
      </div>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {logs && logs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-4 py-2 text-left">Date & Time</th>
                    <th className="px-4 py-2 text-left">Employee</th>
                    <th className="px-4 py-2 text-left">Event Type</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log: AttendanceLog) => (
                    <tr key={log.id} className="border-t border-border/50 hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="font-medium">{format(new Date(log.timestamp || ''), 'MMM d, yyyy')}</div>
                        <div className="text-sm text-muted-foreground">{format(new Date(log.timestamp || ''), 'h:mm:ss a')}</div>
                      </td>
                      <td className="px-4 py-3">
                        {log.profiles?.full_name || 'Unknown'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          log.event_type === 'signin' ? 'bg-green-500/10 text-green-600' :
                          log.event_type === 'signout' ? 'bg-red-500/10 text-red-600' :
                          log.event_type === 'break_start' ? 'bg-amber-500/10 text-amber-600' :
                          log.event_type === 'break_end' ? 'bg-blue-500/10 text-blue-600' :
                          'bg-gray-500/10 text-gray-600'
                        }`}>
                          {log.event_type === 'signin' ? 'Sign In' :
                           log.event_type === 'signout' ? 'Sign Out' :
                           log.event_type === 'break_start' ? 'Break Start' :
                           log.event_type === 'break_end' ? 'Break End' :
                           log.event_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/mgmt/adjustments/${log.id}`}>
                          <Button variant="outline" size="sm">Edit</Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No attendance logs found for the selected filters.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
