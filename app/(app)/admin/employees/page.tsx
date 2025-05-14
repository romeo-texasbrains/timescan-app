import { createClient } from '@/lib/supabase/server';
import { Database } from '@/lib/supabase/database.types';
import Link from 'next/link'; // Ensure Link is imported
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination" // Assuming shadcn pagination exists/is added
import { Button } from '@/components/ui/button'; // Assuming shadcn button exists/is added
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/types/profile';
import clsx from 'clsx'; // Correct import for clsx
import EmployeeActions from '@/components/EmployeeActions';

type Profile = Database['public']['Tables']['profiles']['Row'];

// Define a type specific to the columns selected
type FetchedProfile = Pick<Profile, 'id' | 'full_name' | 'email' | 'role' | 'created_at' | 'department_id'>;

const ITEMS_PER_PAGE = 15; // Employees per page

export default async function EmployeesPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const awaitedSearchParams = await searchParams;
  const supabase = await createClient();

  // --- Authentication/Authorization (Redundant if Layout handles it, but good practice) ---
  // We already know user is admin from layout, but could double check here if needed
  // const { data: { user } } = await supabase.auth.getUser();
  // const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single();
  // if (profile?.role !== 'admin') { /* Handle unauthorized */ }
  // -------------------------------------------------------------------------------------

  // --- Pagination ---
  const currentPage = parseInt(awaitedSearchParams?.page as string || '1', 10);
  const safeCurrentPage = Math.max(1, isNaN(currentPage) ? 1 : currentPage);
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE - 1;

  // --- Data Fetching ---
  const { data, error, count } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, created_at, department_id', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(startIndex, endIndex);

  if (error) {
    console.error("Error fetching profiles:", error);
    return <p className="text-red-500 p-4">Error loading employee data: {error.message}</p>;
  }

  // Fetch departments to display department names
  const { data: departments, error: departmentsError } = await supabase
    .from('departments')
    .select('id, name');

  if (departmentsError) {
    console.error("Error fetching departments:", departmentsError);
  }

  // Create a map of department IDs to names
  const departmentMap = new Map<string, string>();
  departments?.forEach(dept => {
    departmentMap.set(dept.id, dept.name);
  });

  // Use the specific FetchedProfile type here (we'll need to update it)
  const profiles = data || [];
  const totalPages = Math.ceil((count || 0) / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6 text-foreground">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h1 className="text-2xl sm:text-3xl font-bold">Manage Employees</h1>
          </div>
          <p className="text-muted-foreground mt-1 ml-8">View, edit, and manage employee profiles and roles</p>
        </div>

        <div className="flex space-x-3">
          <Link href="/admin" className="inline-flex items-center px-4 py-2 bg-card border border-border/50 text-foreground rounded-lg transition-colors hover:bg-accent/30">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-muted-foreground" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back
          </Link>

          <Link href="/admin/employees/profiles">
            <Button variant="outline" className="bg-card hover:bg-primary/10 border-primary/30 text-primary transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
              View Profiles
            </Button>
          </Link>

          <Link href="/admin/employees/new">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto shadow-md transition-all duration-300 hover:shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
              </svg>
              Add Employee
            </Button>
          </Link>
        </div>
      </div>

      <div className="bg-card/70 dark:bg-card/70 backdrop-blur-md border border-white/10 shadow-lg rounded-xl overflow-hidden transition-all duration-300 hover:shadow-xl">
        <div className="overflow-x-auto">
          <Table>
            <TableCaption className="py-4 text-muted-foreground">
              <div className="flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted-foreground mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                A list of all registered employees in the system
              </div>
            </TableCaption>
            <TableHeader className="bg-primary/5">
              <TableRow>
                <TableHead className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Full Name</TableHead>
                <TableHead className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Email</TableHead>
                <TableHead className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Role</TableHead>
                <TableHead className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Department</TableHead>
                <TableHead className="px-4 sm:px-6 py-4 text-left text-xs font-semibold text-foreground uppercase tracking-wider">Joined Date</TableHead>
                <TableHead className="px-4 sm:px-6 py-4 text-right text-xs font-semibold text-foreground uppercase tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border/50">
              {profiles.length > 0 ? (
                profiles.map((profile, idx) => (
                  <TableRow
                    key={profile.id}
                    className={`transition-colors hover:bg-primary/5 ${idx % 2 === 0 ? 'bg-transparent' : 'bg-muted/10'}`}
                  >
                    <TableCell className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Avatar className="h-10 w-10 border border-primary/20">
                          {profile.profile_picture_url ? (
                            <AvatarImage src={profile.profile_picture_url} alt={profile.full_name || ''} />
                          ) : (
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {profile.full_name ? getInitials(profile.full_name) : '?'}
                            </AvatarFallback>
                          )}
                        </Avatar>
                        <div className="ml-4">
                          <Link href={`/admin/employees/profiles/${profile.id}`} className="hover:text-primary hover:underline transition-colors">
                            <div className="text-sm font-medium text-foreground">{profile.full_name || '-'}</div>
                          </Link>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-foreground">{profile.email}</div>
                      <div className="text-xs text-muted-foreground">User Account</div>
                    </TableCell>
                    <TableCell className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${
                        profile.role === 'admin'
                          ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                          : profile.role === 'manager'
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                            : 'bg-green-500/10 text-green-600 dark:text-green-400'
                      }`}>
                        {profile.role}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      {profile.department_id ? (
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                          {departmentMap.get(profile.department_id) || 'Unknown'}
                        </span>
                      ) : (
                        <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-500/10 text-gray-600 dark:text-gray-400">
                          Not Assigned
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-foreground">{format(new Date(profile.created_at), 'MMM d, yyyy')}</div>
                      <div className="text-xs text-muted-foreground">{format(new Date(profile.created_at), 'h:mm a')}</div>
                    </TableCell>
                    <TableCell className="px-4 sm:px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex justify-end items-center space-x-2">
                        <Link href={`/admin/employees/profiles/${profile.id}`}>
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-card hover:bg-primary/10 border-primary/30 text-primary transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                            </svg>
                            View/Edit
                          </Button>
                        </Link>
                        <EmployeeActions
                          userId={profile.id}
                          userName={profile.full_name || 'Unnamed Employee'}
                          isCurrentUser={false}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-muted-foreground/50 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <p className="text-sm font-medium text-muted-foreground">No employees found</p>
                      <p className="text-xs text-muted-foreground mt-1">Add employees using the button above</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {totalPages > 1 && (
        <Pagination className="pt-4">
          <PaginationContent className="bg-card/70 dark:bg-card/70 backdrop-blur-md border border-white/10 shadow-md rounded-lg p-3 flex items-center justify-between w-full">
            <div className="flex items-center">
              <PaginationItem>
                <PaginationPrevious
                  href={safeCurrentPage > 1 ? `?page=${safeCurrentPage - 1}` : '#'}
                  className={clsx(
                    "transition-all duration-300 rounded-lg border border-border/50",
                    safeCurrentPage <= 1
                      ? 'pointer-events-none text-muted-foreground/50 opacity-50'
                      : 'hover:bg-primary/10 hover:border-primary/30 text-foreground'
                  )}
                />
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href={safeCurrentPage < totalPages ? `?page=${safeCurrentPage + 1}` : '#'}
                  className={clsx(
                    "transition-all duration-300 rounded-lg border border-border/50",
                    safeCurrentPage >= totalPages
                      ? 'pointer-events-none text-muted-foreground/50 opacity-50'
                      : 'hover:bg-primary/10 hover:border-primary/30 text-foreground'
                  )}
                />
              </PaginationItem>
            </div>

            <div className="flex items-center bg-primary/5 px-4 py-2 rounded-lg">
              <span className="text-sm font-medium text-foreground">Page {safeCurrentPage} of {totalPages}</span>
              <span className="mx-2 text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">{profiles.length} of {count} employees</span>
            </div>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}