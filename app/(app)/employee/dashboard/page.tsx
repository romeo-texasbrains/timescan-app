import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import ClientWrapper from './ClientWrapper';
import { requireRole } from '@/lib/auth/session';

export default async function EmployeeDashboard() {
  try {
    // Require employee role (or admin/manager for testing)
    const session = await requireRole(['employee', 'admin', 'manager']);

    // Use the unified API endpoint to fetch dashboard data
    // For server components, we can directly call the API handler
    const { GET: getUserDashboard } = await import('@/app/api/dashboard/user/route');
    const dashboardResponse = await getUserDashboard(
      new Request('http://localhost:3000/api/dashboard/user')
    );

    if (!dashboardResponse.ok) {
      throw new Error(`Failed to fetch employee dashboard data: ${dashboardResponse.statusText}`);
    }

    const dashboardData = await dashboardResponse.json();

    // Call our recent activity API handler directly to get the user's recent activity
    const { GET: getRecentActivity } = await import('@/app/api/activity/recent/route');
    const activityResponse = await getRecentActivity(
      new Request(`http://localhost:3000/api/activity/recent?userId=${session.id}&limit=20`)
    );

    if (!activityResponse.ok) {
      console.warn(`Failed to fetch recent activity: ${activityResponse.statusText}`);
      // Continue without recent activity data
    } else {
      const activityData = await activityResponse.json();
      console.log('Server-side: Successfully fetched recent activity from API');

      // Add recent activity data to the dashboard data
      dashboardData.recentActivity = activityData.logs || [];
    }
    console.log('Server-side: Successfully fetched employee dashboard data from API');

    // Wrap the content in Suspense to show loading indicator
    return (
      <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><LoadingSpinner size="lg" /></div>}>
        <ClientWrapper initialData={dashboardData} />
      </Suspense>
    );
  } catch (error) {
    console.error('Error fetching employee dashboard data:', error);

    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md mb-6">
          <h2 className="text-lg font-semibold mb-2">Error Loading Dashboard</h2>
          <p>There was a problem loading the dashboard data. Please try refreshing the page or contact support if the issue persists.</p>
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
