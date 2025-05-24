import DashboardClient from "@/components/DashboardClient";
import DashboardChartsSection from "@/components/DashboardChartsSection";
import { createClient } from "@/lib/supabase/server";
import { AttendanceProvider } from "@/context/AttendanceContext";
import { Suspense } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { calculateUserAttendanceMetrics } from "@/lib/utils/metrics-calculator";

export default async function TimeScanDashboard() {
  const supabase = await createClient();
  // Get user session
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch timezone setting
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

  // Fetch initial metrics from the API instead of raw logs
  let initialMetrics = null;
  let initialLogs = [];

  try {
    if (user?.id) {
      // Fetch ALL logs for the user, not just today's logs
      const { data: logs, error: logsError } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: true });

      if (logsError) {
        console.error('Error fetching attendance logs:', logsError);
        throw logsError;
      }

      console.log(`Fetched ${logs?.length || 0} attendance logs for user ${user.id}`);

      // Calculate metrics directly using the utility function
      initialLogs = logs || [];
      initialMetrics = calculateUserAttendanceMetrics(initialLogs, timezone, user.id);

      console.log('Server-side metrics calculated successfully:', initialMetrics);
    } else {
      console.warn('No user ID available for metrics calculation');
    }
  } catch (error) {
    console.error('Error calculating metrics:', error);
    // Set initialMetrics to null to trigger client-side calculation
    initialMetrics = null;
  }

  // Fetch user profile with department info
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role, department_id')
    .eq('id', user?.id)
    .single();

  // Fetch department info if user has a department
  let departmentName = null;
  if (profile?.department_id) {
    const { data: department } = await supabase
      .from('departments')
      .select('name')
      .eq('id', profile.department_id)
      .single();

    departmentName = department?.name || null;
  }

  return (
    <Suspense fallback={<div className="flex justify-center items-center min-h-screen"><LoadingSpinner size="lg" /></div>}>
      <AttendanceProvider
        initialLogs={initialLogs}
        initialMetrics={initialMetrics}
        userId={user?.id || ''}
        timezone={timezone}
      >
        <div className="container mx-auto p-4">
          <DashboardClient
            userProfile={profile || null}
            departmentName={departmentName}
            timezone={timezone}
          />
          <DashboardChartsSection />
        </div>
      </AttendanceProvider>
    </Suspense>
  );
}
