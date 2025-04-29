import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import Link from 'next/link'
import { Database } from '@/lib/supabase/database.types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Settings, BarChart } from 'lucide-react';

// Define types based on the actual SELECT query
type ProfileSelection = Pick<Database['public']['Tables']['profiles']['Row'], 'full_name' | 'email'>;
type AttendanceLogSelection = Pick<
  Database['public']['Tables']['attendance_logs']['Row'], 
  'id' | 'timestamp' | 'event_type'
>;

type AdminLogRow = AttendanceLogSelection & {
  profiles: ProfileSelection[] | null;
}

const ITEMS_PER_PAGE = 25; // Define items per page for admin view

// Await searchParams as per Next.js 15 best practices
export default async function AdminPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const awaitedSearchParams = await searchParams;
  const supabase = await createClient()
  
  const currentPage = parseInt(awaitedSearchParams?.page as string || '1', 10);
  const selectedUser = awaitedSearchParams?.user as string || 'all';
  const selectedDateRange = awaitedSearchParams?.dateRange as string || 'all';
  const selectedEventType = awaitedSearchParams?.eventType as string || 'all';

  // Ensure currentPage is valid
  const safeCurrentPage = Math.max(1, isNaN(currentPage) ? 1 : currentPage);
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE - 1;
  
  // Base query
  let query = supabase
    .from('attendance_logs')
    .select(`
      id, timestamp, event_type,
      profiles:user_id (full_name, email)
    `, { count: 'exact' });

  // Apply filters
  if (selectedUser !== 'all') {
    query = query.eq('user_id', selectedUser);
  }
  if (selectedEventType !== 'all') {
    query = query.eq('event_type', selectedEventType);
  }
  // TODO: Implement proper date range filtering based on selectedDateRange value
  // Example (needs date-fns or similar):
  // if (selectedDateRange === 'last7days') {
  //   const sevenDaysAgo = new Date();
  //   sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  //   query = query.gte('timestamp', sevenDaysAgo.toISOString());
  // }

  // Apply order and range
  query = query.order('timestamp', { ascending: false })
               .range(startIndex, endIndex);

  // Execute query & fetch users in parallel
  const [logsResult, usersResult] = await Promise.all([
      query,
      supabase.from('profiles').select('id, full_name').order('full_name')
  ]);

  const { data: logsData, error: logsError, count } = logsResult;
  const { data: usersData, error: usersError } = usersResult;

  // Handle logs error
  if (logsError) {
    console.error('Error fetching attendance logs:', logsError)
    // Simple error display for now
    return <p className="text-red-500 p-4">Error loading attendance data: {logsError.message}</p>
  }
  // Handle users error (optional, maybe just log it)
  if (usersError) {
      console.error('Error fetching users for filter:', usersError);
      // Continue rendering without the filter options potentially?
  }

  const totalPages = Math.ceil((count || 0) / ITEMS_PER_PAGE);
  const typedLogs: AdminLogRow[] = logsData || [];
  const users = usersData || []; // Use fetched users

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Page Title */}
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>

      {/* Quick Links Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/admin/employees">
          <Card className="hover:shadow-lg transition-shadow duration-200 cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Manage Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                View, edit, and manage employee profiles and roles.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/reports" className="pointer-events-none"> {/* Disable link for now */}
          <Card className="hover:shadow-lg transition-shadow duration-200 cursor-not-allowed opacity-60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Generate Reports</CardTitle>
              <BarChart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                (Coming Soon) Generate attendance summary reports.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/settings" className="pointer-events-none"> {/* Disable link for now */}
           <Card className="hover:shadow-lg transition-shadow duration-200 cursor-not-allowed opacity-60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Settings</CardTitle>
              <Settings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                (Coming Soon) Configure application settings.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Existing Filters Form */}
      <form method="GET" action="/admin" className="bg-gray-50 dark:bg-gray-800 p-4 rounded-md">
        <input type="hidden" name="page" value={safeCurrentPage} /> 
        <h2 className="text-lg font-semibold mb-3">Filter Attendance Logs</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label htmlFor="dateRange" className="block text-sm font-medium mb-1">Date Range</label>
            <select id="dateRange" name="dateRange" defaultValue={selectedDateRange} className="w-full rounded-md border-gray-300 shadow-sm p-2 dark:bg-gray-700 dark:border-gray-600">
              <option value="all">All Time</option>
              <option value="last7days">Last 7 days</option>
              <option value="last30days">Last 30 days</option>
            </select>
          </div>
          <div>
            <label htmlFor="user" className="block text-sm font-medium mb-1">User</label>
            <select id="user" name="user" defaultValue={selectedUser} className="w-full rounded-md border-gray-300 shadow-sm p-2 dark:bg-gray-700 dark:border-gray-600">
              <option value="all">All Users</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="eventType" className="block text-sm font-medium mb-1">Event Type</label>
            <select id="eventType" name="eventType" defaultValue={selectedEventType} className="w-full rounded-md border-gray-300 shadow-sm p-2 dark:bg-gray-700 dark:border-gray-600">
              <option value="all">All Types</option>
              <option value="signin">Sign In</option>
              <option value="signout">Sign Out</option>
            </select>
          </div>
          <div>
             <button type="submit" className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm font-medium">
               Apply Filters
             </button>
          </div>
        </div>
      </form>
      
      {/* Existing Attendance Records Table */}
      <div className="overflow-x-auto shadow-md rounded-lg">
         <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
           <thead className="bg-gray-50 dark:bg-gray-800">
             <tr>
               <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date & Time</th>
               <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Employee</th>
               <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Event Type</th>
               <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
             </tr>
           </thead>
           <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
             {typedLogs.length > 0 ? (
               typedLogs.map((log) => {
                 const profile = Array.isArray(log.profiles) ? log.profiles[0] : log.profiles; // Handle potential single object
                 return (
                 <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{format(new Date(log.timestamp || 0), 'MMM d, yyyy h:mm a')}</td>
                   <td className="px-6 py-4 whitespace-nowrap">
                     <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{profile?.full_name || 'Unknown User'}</div>
                     <div className="text-sm text-gray-500 dark:text-gray-400">{profile?.email || '-'}</div>
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap">
                     <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${log.event_type === 'signin' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100' : 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100'}`}>{log.event_type}</span>
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                     <Link href={`/admin/logs/${log.id}`} className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 mr-3">Edit</Link>
                     <button disabled className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed">Delete</button>
                   </td>
                 </tr>
                 );
               })
             ) : (
               <tr><td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">No attendance records found matching filters.</td></tr>
             )}
           </tbody>
         </table>
      </div>
      
      {/* Existing Pagination Controls - Use safeCurrentPage */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
            <Link href={`?page=${safeCurrentPage - 1}&user=${selectedUser}&dateRange=${selectedDateRange}&eventType=${selectedEventType}`} className={`px-4 py-2 border rounded-md text-sm ${safeCurrentPage <= 1 ? 'text-gray-400 bg-gray-100 cursor-not-allowed' : 'bg-white hover:bg-gray-50'}`} aria-disabled={safeCurrentPage <= 1} tabIndex={safeCurrentPage <= 1 ? -1 : undefined}>Previous</Link>
            <span className="text-sm text-gray-700">Page {safeCurrentPage} of {totalPages} ({(count || 0)} total records)</span>
            <Link href={`?page=${safeCurrentPage + 1}&user=${selectedUser}&dateRange=${selectedDateRange}&eventType=${selectedEventType}`} className={`px-4 py-2 border rounded-md text-sm ${safeCurrentPage >= totalPages ? 'text-gray-400 bg-gray-100 cursor-not-allowed' : 'bg-white hover:bg-gray-50'}`} aria-disabled={safeCurrentPage >= totalPages} tabIndex={safeCurrentPage >= totalPages ? -1 : undefined}>Next</Link>
        </div>
      )}
    </div>
  )
}
