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
import clsx from 'clsx'; // Correct import for clsx

type Profile = Database['public']['Tables']['profiles']['Row'];

// Define a type specific to the columns selected
type FetchedProfile = Pick<Profile, 'id' | 'full_name' | 'email' | 'role' | 'created_at'>;

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
    .select('id, full_name, email, role, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(startIndex, endIndex);

  if (error) {
    console.error("Error fetching profiles:", error);
    return <p className="text-red-500 p-4">Error loading employee data: {error.message}</p>;
  }

  // Use the specific FetchedProfile type here
  const profiles: FetchedProfile[] = data || [];
  const totalPages = Math.ceil((count || 0) / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6 text-foreground">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold">Manage Employees</h1>
        <Link href="/admin/employees/new">
           <Button className="bg-primary hover:bg-primary/90 text-primary-foreground w-full sm:w-auto">Add Employee</Button> 
        </Link>
      </div>

      <div className="bg-card/70 dark:bg-card/70 backdrop-blur-md border border-white/5 shadow-lg rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
            <Table>
              <TableCaption className="py-4 text-muted-foreground">A list of all registered employees.</TableCaption>
              <TableHeader className="bg-muted/20 dark:bg-muted/20">
                <TableRow>
                  <TableHead className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Full Name</TableHead>
                  <TableHead className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</TableHead>
                  <TableHead className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</TableHead>
                  <TableHead className="px-4 sm:px-6 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Joined Date</TableHead>
                  <TableHead className="px-4 sm:px-6 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/50">
                {profiles.length > 0 ? (
                  profiles.map((profile) => (
                    <TableRow key={profile.id} className="hover:bg-accent/30 dark:hover:bg-accent/30 transition-colors">
                      <TableCell className="px-4 sm:px-6 py-4 whitespace-nowrap font-medium text-foreground">{profile.full_name || '-'}</TableCell>
                      <TableCell className="px-4 sm:px-6 py-4 whitespace-nowrap text-muted-foreground">{profile.email}</TableCell>
                      <TableCell className="px-4 sm:px-6 py-4 whitespace-nowrap capitalize text-muted-foreground">{profile.role}</TableCell>
                      <TableCell className="px-4 sm:px-6 py-4 whitespace-nowrap text-muted-foreground">{format(new Date(profile.created_at), 'PP')}</TableCell>
                      <TableCell className="px-4 sm:px-6 py-4 whitespace-nowrap text-right">
                        <Link href={`/admin/employees/${profile.id}`}>
                          <Button variant="outline" size="sm" className="bg-card/70 hover:bg-accent/50 border-border/50">View/Edit</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      No employees found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
        </div>
      </div>

      {totalPages > 1 && (
        <Pagination className="pt-4">
          <PaginationContent className="bg-card/70 dark:bg-card/70 backdrop-blur-md border border-white/5 shadow-md rounded-lg p-2">
            <PaginationItem>
              <PaginationPrevious 
                 href={safeCurrentPage > 1 ? `?page=${safeCurrentPage - 1}` : '#'}
                 className={clsx(safeCurrentPage <= 1 && 'pointer-events-none text-muted-foreground/50', 'hover:bg-accent/50')}
               />
            </PaginationItem>
            <PaginationItem>
                 <span className="px-4 py-2 text-sm font-medium text-muted-foreground">Page {safeCurrentPage} of {totalPages}</span>
             </PaginationItem>
            <PaginationItem>
              <PaginationNext 
                 href={safeCurrentPage < totalPages ? `?page=${safeCurrentPage + 1}` : '#'}
                 className={clsx(safeCurrentPage >= totalPages && 'pointer-events-none text-muted-foreground/50', 'hover:bg-accent/50')}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}