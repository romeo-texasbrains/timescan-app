import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { format, subDays } from 'date-fns';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import ClientWrapper from './ClientWrapper';
import { requireAuth } from '@/lib/auth/session';
import { getUsers } from '@/lib/db/queries';

export default async function AttendanceHistoryPage() {
  try {
    // Require authentication
    const session = await requireAuth();

    // Set default date range (last 7 days)
    const endDate = new Date();
    const startDate = subDays(endDate, 7);
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');

    // Fetch initial data based on user role
    let users: any[] = [];

    if (session.role === 'admin') {
      // Admin can see all users
      users = await getUsers({});
    } else if (session.role === 'manager' && session.department_id) {
      // Manager can see users in their department
      users = await getUsers({ departmentIds: [session.department_id] });
    }

    // Call the attendance history API
    const params = new URLSearchParams({
      startDate: startDateStr,
      endDate: endDateStr,
      groupByDay: 'false', // Default to list view
      includeMetrics: 'true'
    });

    // For employees, add their user ID to the params
    if (session.role === 'employee') {
      params.append('userId', session.id);
    }

    // Use the API handler directly for server components
    const { GET } = await import('@/app/api/attendance/history/route');
    const response = await GET(
      new Request(`http://localhost:3000/api/attendance/history?${params.toString()}`)
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch attendance history: ${response.statusText}`);
    }

    const historyData = await response.json();

    // Add user role and users list to the data
    const initialData = {
      ...historyData,
      users,
      userRole: session.role
    };

    // Wrap the content in Suspense to show loading indicator
    return (
      <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><LoadingSpinner size="lg" /></div>}>
        <ClientWrapper initialData={initialData} />
      </Suspense>
    );
  } catch (error) {
    console.error('Error fetching attendance history:', error);

    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
          <h2 className="text-lg font-semibold mb-2">Error Loading Attendance History</h2>
          <p>There was a problem loading the attendance history. Please try refreshing the page or contact support if the issue persists.</p>
          <p className="text-sm mt-2">Error details: {error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
        <div className="flex justify-center mt-4">
          <a href="/" className="px-4 py-2 bg-primary text-primary-foreground rounded-md">
            Return to Home
          </a>
        </div>
      </div>
    );
  }
}
