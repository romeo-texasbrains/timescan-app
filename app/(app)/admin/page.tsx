import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'
import Link from 'next/link'
import { Database } from '@/lib/supabase/database.types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Settings, BarChart } from 'lucide-react';
import clsx from 'clsx';

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
    <div className="container mx-auto px-4 py-6 space-y-8 text-foreground">
      <h1 className="text-3xl font-bold mb-4">Admin Dashboard</h1>

      {/* Quick Links Section - Adjust grid and gap */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <Link href="/admin/employees" className="block group">
          <Card className="bg-card/70 dark:bg-card/70 backdrop-blur-md border border-white/5 rounded-xl shadow-lg p-4 group-hover:shadow-xl group-hover:border-white/10 transition-all duration-200 h-full hover:scale-[1.03]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-semibold text-foreground">Manage Employees</CardTitle>
              <Users className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View, edit, and manage employee profiles and roles.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/qr-codes" className="block group">
          <Card className="bg-card/70 dark:bg-card/70 backdrop-blur-md border border-white/5 rounded-xl shadow-lg p-4 group-hover:shadow-xl group-hover:border-white/10 transition-all duration-200 h-full hover:scale-[1.03]">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-foreground">Manage QR Codes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Generate, view, and manage QR codes for attendance scanning locations.</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/reports" className="block group pointer-events-none">
          <Card className="bg-card/50 dark:bg-card/50 backdrop-blur-sm border border-white/5 rounded-xl shadow-lg p-4 cursor-not-allowed opacity-50 h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-semibold text-foreground">Generate Reports</CardTitle>
              <BarChart className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                (Coming Soon) Generate attendance summary reports.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/settings" className="block group pointer-events-none">
           <Card className="bg-card/50 dark:bg-card/50 backdrop-blur-sm border border-white/5 rounded-xl shadow-lg p-4 cursor-not-allowed opacity-50 h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-semibold text-foreground">Settings</CardTitle>
              <Settings className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                (Coming Soon) Configure application settings.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Filter Form - Adjust grid and styles */}
      <form method="GET" action="/admin"
        className="bg-card/70 dark:bg-card/70 backdrop-blur-md border border-white/5 p-6 rounded-xl shadow-lg"
      >
        <h2 className="text-xl font-semibold mb-4 text-foreground">Filter Attendance Logs</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label htmlFor="dateRange" className="block text-sm font-medium mb-1 text-muted-foreground">Date Range</label>
            <select id="dateRange" name="dateRange" defaultValue={selectedDateRange} className="w-full rounded-md border border-border/50 bg-input/50 p-2 focus:ring-primary focus:border-primary text-foreground backdrop-blur-sm">
              <option value="all">All Time</option>
              <option value="last7days">Last 7 days</option>
              <option value="last30days">Last 30 days</option>
            </select>
          </div>
          <div>
            <label htmlFor="user" className="block text-sm font-medium mb-1 text-muted-foreground">User</label>
            <select id="user" name="user" defaultValue={selectedUser} className="w-full rounded-md border border-border/50 bg-input/50 p-2 focus:ring-primary focus:border-primary text-foreground backdrop-blur-sm">
              <option value="all">All Users</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="eventType" className="block text-sm font-medium mb-1 text-muted-foreground">Event Type</label>
            <select id="eventType" name="eventType" defaultValue={selectedEventType} className="w-full rounded-md border border-border/50 bg-input/50 p-2 focus:ring-primary focus:border-primary text-foreground backdrop-blur-sm">
              <option value="all">All Types</option>
              <option value="signin">Sign In</option>
              <option value="signout">Sign Out</option>
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
             <button type="submit" className="w-full px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md shadow font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary transition-transform hover:scale-[1.02]">
               Apply Filters
             </button>
          </div>
        </div>
      </form>
      
      {/* Attendance Records Table - Refine styles */}
      <div className="bg-card/70 dark:bg-card/70 backdrop-blur-md border border-white/5 overflow-hidden shadow-lg rounded-xl">
         <div className="overflow-x-auto">
             <table className="min-w-full divide-y divide-border/50">
               <thead className="bg-muted/20 dark:bg-muted/20">
                 <tr>
                   <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date & Time</th>
                   <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Employee</th>
                   <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Event Type</th>
                   <th scope="col" className="px-6 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-border/50">
                 {typedLogs.length > 0 ? (
                   typedLogs.map((log) => {
                     const profile = Array.isArray(log.profiles) ? log.profiles[0] : log.profiles;
                     return (
                     <tr key={log.id} className="hover:bg-accent/30 dark:hover:bg-accent/30 transition-colors">
                       <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{format(new Date(log.timestamp || 0), 'MMM d, yyyy h:mm a')}</td>
                       <td className="px-6 py-4 whitespace-nowrap">
                         <div className="text-sm font-medium text-foreground">{profile?.full_name || 'Unknown User'}</div>
                         <div className="text-sm text-muted-foreground">{profile?.email || '-'}</div>
                       </td>
                       <td className="px-6 py-4 whitespace-nowrap">
                         <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${log.event_type === 'signin' ? 'bg-green-900/70 text-green-100' : 'bg-red-900/70 text-red-100'}`}>{log.event_type}</span>
                       </td>
                       <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                         <Link href={`/admin/logs/${log.id}`} className="text-primary/90 hover:text-primary font-medium">Edit</Link>
                         <button disabled className="text-destructive/70 hover:text-destructive disabled:opacity-50 disabled:cursor-not-allowed font-medium">Delete</button>
                       </td>
                     </tr>
                     );
                   })
                 ) : (
                   <tr><td colSpan={4} className="px-6 py-4 text-center text-sm text-muted-foreground">No attendance records found matching filters.</td></tr>
                 )}
               </tbody>
             </table>
         </div>
      </div>
      
      {/* Pagination Controls - Refine Styles */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row justify-between items-center mt-6 text-sm gap-3">
            <Link 
              href={`?page=${safeCurrentPage - 1}&user=${selectedUser}&dateRange=${selectedDateRange}&eventType=${selectedEventType}`} 
              className={clsx(
                "px-4 py-2 border border-border/50 rounded-md font-medium transition-colors", 
                safeCurrentPage <= 1 
                  ? 'text-muted-foreground bg-muted/30 cursor-not-allowed' 
                  : 'bg-card/70 hover:bg-accent/50 text-foreground'
              )}
              aria-disabled={safeCurrentPage <= 1} 
              tabIndex={safeCurrentPage <= 1 ? -1 : undefined}
            >Previous</Link>
            
            <span className="text-muted-foreground">Page {safeCurrentPage} of {totalPages} ({(count || 0)} total records)</span>
            
            <Link 
              href={`?page=${safeCurrentPage + 1}&user=${selectedUser}&dateRange=${selectedDateRange}&eventType=${selectedEventType}`} 
              className={clsx(
                "px-4 py-2 border border-border/50 rounded-md font-medium transition-colors", 
                safeCurrentPage >= totalPages 
                  ? 'text-muted-foreground bg-muted/30 cursor-not-allowed' 
                  : 'bg-card/70 hover:bg-accent/50 text-foreground'
              )}
              aria-disabled={safeCurrentPage >= totalPages} 
              tabIndex={safeCurrentPage >= totalPages ? -1 : undefined}
            >Next</Link>
        </div>
      )}
    </div>
  )
}
