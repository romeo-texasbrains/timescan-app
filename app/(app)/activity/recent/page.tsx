import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ClientWrapper from './ClientWrapper';
import { requireAuth } from '@/lib/auth/session';
import { getUsers, getDepartments } from '@/lib/db/queries';

export default async function RecentActivityPage() {
  try {
    // Require authentication
    const session = await requireAuth();

    // Fetch initial data based on user role
    let users: any[] = [];
    let departments: any[] = [];

    if (session.role === 'admin') {
      // Admin can see all users and departments
      users = await getUsers({});
      departments = await getDepartments();
    } else if (session.role === 'manager' && session.department_id) {
      // Manager can see users in their department
      users = await getUsers({ departmentIds: [session.department_id] });
      departments = await getDepartments({ departmentId: session.department_id });
    }

    // Call the recent activity API
    const { GET } = await import('@/app/api/activity/recent/route');
    const response = await GET(
      new Request('http://localhost:3000/api/activity/recent')
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch recent activity: ${response.statusText}`);
    }

    const activityData = await response.json();

    // Add user role, users, and departments to the data
    const initialData = {
      ...activityData,
      users,
      departments,
      userRole: session.role
    };

    // Wrap the content in Suspense to show loading indicator
    return (
      <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><LoadingSpinner size="lg" /></div>}>
        <ClientWrapper initialData={initialData} />
      </Suspense>
    );
  } catch (error) {
    console.error('Error fetching recent activity:', error);

    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
          <h2 className="text-lg font-semibold mb-2">Error Loading Recent Activity</h2>
          <p>There was a problem loading the recent activity data. Please try refreshing the page or contact support if the issue persists.</p>
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
