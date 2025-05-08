import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Database } from '@/lib/supabase/database.types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Settings, BarChart } from 'lucide-react';
import clsx from 'clsx';
import AdminAttendanceTable, { AdminLogRow } from '@/components/AdminAttendanceTable';

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-muted-foreground mt-1">Manage employees, QR codes, and view attendance records</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
              <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
            </svg>
            Team Dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
            Home
          </Link>
        </div>
      </div>

      {/* Quick Links Section - Enhanced with icons and better visual hierarchy */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link href="/admin/employees" className="block group">
          <Card className="bg-card/70 dark:bg-card/70 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-5 group-hover:shadow-xl group-hover:border-primary/20 transition-all duration-300 h-full hover:scale-[1.02]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-0 pt-0">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div className="text-xs font-medium px-2 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                Active
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <CardTitle className="text-lg font-semibold text-foreground mb-2">Manage Employees</CardTitle>
              <p className="text-sm text-muted-foreground">
                View, edit, and manage employee profiles and roles.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/qr-codes" className="block group">
          <Card className="bg-card/70 dark:bg-card/70 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-5 group-hover:shadow-xl group-hover:border-primary/20 transition-all duration-300 h-full hover:scale-[1.02]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-0 pt-0">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
              </div>
              <div className="text-xs font-medium px-2 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                Active
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <CardTitle className="text-lg font-semibold text-foreground mb-2">Manage QR Codes</CardTitle>
              <p className="text-sm text-muted-foreground">
                Generate, view, and manage QR codes for attendance scanning locations.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/reports" className="block group pointer-events-none">
          <Card className="bg-card/50 dark:bg-card/50 backdrop-blur-sm border border-white/5 rounded-xl shadow-lg p-5 cursor-not-allowed opacity-70 h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-0 pt-0">
              <div className="h-12 w-12 rounded-full bg-muted/20 flex items-center justify-center mb-2">
                <BarChart className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-xs font-medium px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                Coming Soon
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <CardTitle className="text-lg font-semibold text-foreground mb-2">Generate Reports</CardTitle>
              <p className="text-sm text-muted-foreground">
                Generate attendance summary reports and export data.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/settings" className="block group pointer-events-none">
          <Card className="bg-card/50 dark:bg-card/50 backdrop-blur-sm border border-white/5 rounded-xl shadow-lg p-5 cursor-not-allowed opacity-70 h-full">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-0 pt-0">
              <div className="h-12 w-12 rounded-full bg-muted/20 flex items-center justify-center mb-2">
                <Settings className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-xs font-medium px-2 py-1 rounded-full bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                Coming Soon
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <CardTitle className="text-lg font-semibold text-foreground mb-2">Settings</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure application settings and preferences.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Filter Form - Enhanced with better styling */}
      <form method="GET" action="/admin"
        className="bg-card/70 dark:bg-card/70 backdrop-blur-md border border-white/10 p-6 rounded-xl shadow-lg transition-all duration-300 hover:shadow-xl"
      >
        <div className="flex items-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
          </svg>
          <h2 className="text-xl font-semibold text-foreground">Filter Attendance Logs</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="space-y-2">
            <label htmlFor="dateRange" className="block text-sm font-medium text-foreground">Date Range</label>
            <div className="relative">
              <select
                id="dateRange"
                name="dateRange"
                defaultValue={selectedDateRange}
                className="w-full rounded-lg border border-border/50 bg-card p-2.5 pl-10 focus:ring-primary focus:border-primary text-foreground shadow-sm transition-colors"
              >
                <option value="all">All Time</option>
                <option value="last7days">Last 7 days</option>
                <option value="last30days">Last 30 days</option>
              </select>
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="user" className="block text-sm font-medium text-foreground">User</label>
            <div className="relative">
              <select
                id="user"
                name="user"
                defaultValue={selectedUser}
                className="w-full rounded-lg border border-border/50 bg-card p-2.5 pl-10 focus:ring-primary focus:border-primary text-foreground shadow-sm transition-colors"
              >
                <option value="all">All Users</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="eventType" className="block text-sm font-medium text-foreground">Event Type</label>
            <div className="relative">
              <select
                id="eventType"
                name="eventType"
                defaultValue={selectedEventType}
                className="w-full rounded-lg border border-border/50 bg-card p-2.5 pl-10 focus:ring-primary focus:border-primary text-foreground shadow-sm transition-colors"
              >
                <option value="all">All Types</option>
                <option value="signin">Punch In</option>
                <option value="signout">Punch Out</option>
              </select>
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          <div className="sm:col-span-2 lg:col-span-1">
            <button
              type="submit"
              className="w-full px-4 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-md font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary transition-all duration-300 hover:scale-[1.02] flex items-center justify-center touch-manipulation min-h-[3rem]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Apply Filters
            </button>
          </div>
        </div>
      </form>

      {/* Attendance Records Table - Use Client Component */}
      <div className="space-y-4">
        <div className="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
            <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
          </svg>
          <h2 className="text-xl font-semibold text-foreground">Attendance Records</h2>
        </div>
        <AdminAttendanceTable logs={typedLogs} />
      </div>

      {/* Pagination Controls - Enhanced with better styling */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-3 bg-card/70 dark:bg-card/70 backdrop-blur-md border border-white/10 p-4 rounded-xl shadow-md">
          <div className="flex items-center space-x-2">
            <Link
              href={`?page=${safeCurrentPage - 1}&user=${selectedUser}&dateRange=${selectedDateRange}&eventType=${selectedEventType}`}
              className={clsx(
                "px-4 py-2 border border-border/50 rounded-lg font-medium transition-all duration-300 flex items-center",
                safeCurrentPage <= 1
                  ? 'text-muted-foreground bg-muted/30 cursor-not-allowed opacity-50'
                  : 'bg-card hover:bg-primary/10 text-foreground hover:border-primary/30'
              )}
              aria-disabled={safeCurrentPage <= 1}
              tabIndex={safeCurrentPage <= 1 ? -1 : undefined}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Previous
            </Link>

            <Link
              href={`?page=${safeCurrentPage + 1}&user=${selectedUser}&dateRange=${selectedDateRange}&eventType=${selectedEventType}`}
              className={clsx(
                "px-4 py-2 border border-border/50 rounded-lg font-medium transition-all duration-300 flex items-center",
                safeCurrentPage >= totalPages
                  ? 'text-muted-foreground bg-muted/30 cursor-not-allowed opacity-50'
                  : 'bg-card hover:bg-primary/10 text-foreground hover:border-primary/30'
              )}
              aria-disabled={safeCurrentPage >= totalPages}
              tabIndex={safeCurrentPage >= totalPages ? -1 : undefined}
            >
              Next
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </Link>
          </div>

          <div className="flex items-center bg-primary/5 px-4 py-2 rounded-lg">
            <span className="text-sm font-medium text-foreground">Page {safeCurrentPage} of {totalPages}</span>
            <span className="mx-2 text-muted-foreground">•</span>
            <span className="text-sm text-muted-foreground">{(count || 0)} total records</span>
          </div>
        </div>
      )}
    </div>
  )
}
