import { createClient } from '@/lib/supabase/server';
import { format } from 'date-fns';

// Function to fetch adherence data from Supabase
export async function getAdherenceData() {
  const supabase = await createClient();

  // Get recent adherence updates (last 50)
  const { data: recentUpdates, error: updatesError } = await supabase
    .from('attendance_adherence')
    .select(`
      id,
      user_id,
      date,
      status,
      updated_at,
      profiles!attendance_adherence_user_id_fkey(full_name)
    `)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (updatesError) {
    console.error('Error fetching recent adherence updates:', updatesError);
    return { recentUpdates: [], statistics: [] };
  }

  // Get adherence statistics for today
  const today = format(new Date(), 'yyyy-MM-dd');

  // Use a simpler approach to get counts by status
  // First, get all records for today
  const { data: todayRecords, error: todayError } = await supabase
    .from('attendance_adherence')
    .select('status')
    .eq('date', today);

  if (todayError) {
    console.error('Error fetching adherence statistics:', todayError);
    return { recentUpdates, statistics: [] };
  }

  // Then manually count by status
  const statusCounts = [
    { status: 'early', count: 0 },
    { status: 'on_time', count: 0 },
    { status: 'late', count: 0 },
    { status: 'absent', count: 0 },
    { status: 'pending', count: 0 }
  ];

  // Count occurrences of each status
  todayRecords?.forEach(record => {
    const statusItem = statusCounts.find(item => item.status === record.status);
    if (statusItem) {
      statusItem.count += 1;
    }
  });

  return { recentUpdates, statistics: statusCounts };
}

// Function to fetch employees for the dropdown
export async function getEmployees() {
  const supabase = await createClient();

  const { data: employees, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .order('full_name');

  if (error) {
    console.error('Error fetching employees:', error);
    return [];
  }

  return employees;
}
