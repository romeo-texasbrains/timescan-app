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
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination" // Assuming shadcn pagination exists/is added
import { Button } from '@/components/ui/button'; // Assuming shadcn button exists/is added

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
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Manage Employees</h1>
        <Link href="/admin/employees/new">
           <Button>Add Employee</Button> 
        </Link>
      </div>

      <div className="overflow-x-auto shadow-md rounded-lg">
        <Table>
          <TableCaption>A list of all registered employees.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Full Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles.length > 0 ? (
              profiles.map((profile) => (
                <TableRow key={profile.id}>
                  <TableCell className="font-medium">{profile.full_name || '-'}</TableCell>
                  <TableCell>{profile.email}</TableCell>
                  <TableCell className="capitalize">{profile.role}</TableCell>
                  <TableCell>{format(new Date(profile.created_at), 'PPP')}</TableCell>
                  <TableCell className="text-right">
                    {/* Update Edit/View links */}
                    <Link href={`/admin/employees/${profile.id}`}>
                      <Button variant="outline" size="sm" className="mr-2">View/Edit</Button>
                    </Link>
                    {/* Maybe add a separate delete button later if needed */}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No employees found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */} 
      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            {safeCurrentPage > 1 && (
              <PaginationItem>
                <PaginationPrevious href={`?page=${safeCurrentPage - 1}`} />
              </PaginationItem>
            )}
            {/* Basic pagination display - could be enhanced */}
            <PaginationItem>
                 <span className="px-4 py-2 text-sm">Page {safeCurrentPage} of {totalPages}</span>
             </PaginationItem>
            {safeCurrentPage < totalPages && (
              <PaginationItem>
                <PaginationNext href={`?page=${safeCurrentPage + 1}`} />
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      )}
      {/* Removed the misplaced filtering Select block from here */}
    </div>
  );
}