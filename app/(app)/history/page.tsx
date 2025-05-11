import { createClient } from '@/lib/supabase/server'
import { Database } from '@/lib/supabase/database.types'
import { format, parseISO } from 'date-fns'; // Using date-fns for formatting
import { formatInTimeZone } from 'date-fns-tz'; // For timezone-aware formatting
import Link from 'next/link'; // Import Link for pagination

// Helper function to format timestamp with timezone
function formatTimestamp(timestamp: string | null, timezone: string): string {
  if (!timestamp) return 'N/A';
  try {
    // Using timezone-aware formatting
    return formatInTimeZone(parseISO(timestamp), timezone, "PP p");
  } catch (e) {
    console.error("Error formatting date:", e);
    return timestamp;
  }
}

const ITEMS_PER_PAGE = 20;

// Helper async function to fetch logs based on page number
// Accepts the raw page parameter
async function getPaginatedLogs(userId: string, pageParam: string | string[] | undefined) {
  const supabase = await createClient();

  // Parse and validate page number inside the function
  const currentPage = parseInt(pageParam as string || '1', 10);
  const safeCurrentPage = Math.max(1, isNaN(currentPage) ? 1 : currentPage);

  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE - 1;

  const { data: logs, error, count } = await supabase
    .from('attendance_logs')
    .select('id, timestamp, event_type', { count: 'exact' })
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .range(startIndex, endIndex);

  if (error) {
    console.error("Error fetching attendance logs:", error);
    throw new Error(`Error fetching attendance history: ${error.message}`);
  }

  const totalPages = Math.ceil((count || 0) / ITEMS_PER_PAGE);

  // Return logs, the calculated page, and total pages
  return { logs: logs || [], currentPage: safeCurrentPage, totalPages };
}

export default async function HistoryPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const supabase = await createClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return <p className="text-red-600">Error: Could not authenticate user.</p>;
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

  // --- Await searchParams as per Next.js 15 docs ---
  const awaitedSearchParams = await searchParams;
  const pageParam = awaitedSearchParams?.page; // Access page *after* awaiting
  // --------------------------------------------------

  let logs: { id: string; timestamp: string | null; event_type: string | null }[] = [];
  let currentPage = 1;
  let totalPages = 0;
  let fetchError = null;

  try {
    // Pass the awaited page param to the fetch function
    const result = await getPaginatedLogs(user.id, pageParam);
    logs = result.logs;
    currentPage = result.currentPage;
    totalPages = result.totalPages;
  } catch (error: unknown) {
    fetchError = error;
    // Log the error for debugging
    console.error("History page fetch error:", error);
    // Type guard moved inside the catch block to set a user-friendly message
    fetchError = new Error(error instanceof Error ? error.message : 'An unknown error occurred while fetching history.');
  }

  if (fetchError) {
    // Display the message from the fetchError object (which is now guaranteed to be an Error)
    return <p className="text-red-600">{fetchError.message}</p>;
  }

  // --- Render the component ---
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">Your Attendance History</h1>
          <p className="text-sm text-muted-foreground">All times shown in {timezone.replace(/_/g, ' ')} timezone</p>
        </div>
        <Link href="/history/reports" className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 10a1 1 0 10-2 0v3a1 1 0 102 0v-3zm2-3a1 1 0 011 1v5a1 1 0 11-2 0v-5a1 1 0 011-1zm4-1a1 1 0 10-2 0v7a1 1 0 102 0V8z" clipRule="evenodd" />
          </svg>
          View Detailed Reports
        </Link>
      </div>

      {logs && logs.length > 0 ? (
        <>
          <div className="overflow-x-auto shadow-md rounded-lg mb-6">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Event Type
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {formatTimestamp(log.timestamp, timezone)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${log.event_type === 'signin' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {log.event_type}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls - Use currentPage and totalPages */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center">
              <Link
                href={`?page=${currentPage - 1}`}
                className={`px-4 py-2 border rounded-md text-sm ${currentPage <= 1 ? 'text-gray-400 bg-gray-100 cursor-not-allowed' : 'bg-white hover:bg-gray-50'}`}
                aria-disabled={currentPage <= 1}
                tabIndex={currentPage <= 1 ? -1 : undefined}
              >
                Previous
              </Link>
              <span className="text-sm text-gray-700">
                Page {currentPage} of {totalPages}
              </span>
              <Link
                href={`?page=${currentPage + 1}`}
                className={`px-4 py-2 border rounded-md text-sm ${currentPage >= totalPages ? 'text-gray-400 bg-gray-100 cursor-not-allowed' : 'bg-white hover:bg-gray-50'}`}
                aria-disabled={currentPage >= totalPages}
                tabIndex={currentPage >= totalPages ? -1 : undefined}
              >
                Next
              </Link>
            </div>
          )}
        </>
      ) : (
        <p className="text-gray-600">No attendance records found.</p>
      )}
    </div>
  );
}
