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

  return <DashboardClient logs={logs || []} />;
}
