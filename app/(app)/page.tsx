// import Link from "next/link";
import DashboardClient from "@/components/DashboardClient";
import { createClient } from "@/lib/supabase/server";
// import { format } from "date-fns";


export default async function TimeScanDashboard() {
  const supabase = await createClient();
  // Get user session
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch attendance logs for stats and charts
  const { data: logs } = await supabase
    .from('attendance_logs')
    .select('*')
    .eq('user_id', user?.id)
    .order('timestamp', { ascending: false })
    .limit(30);

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

  return <DashboardClient
    logs={logs || []}
    userProfile={profile || null}
    departmentName={departmentName}
  />;
}
