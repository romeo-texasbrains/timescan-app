import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';

export async function GET(request: NextRequest) {
  try {
    // Create authenticated Supabase client
    const cookieStore = cookies();
    const supabase = await createClient();

    // Get session directly from cookies
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
      // For demo/testing purposes, return sample data even if not authenticated
      return NextResponse.json({
        early: 3,
        on_time: 10,
        late: 2,
        absent: 1,
        not_set: 5
      });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const period = searchParams.get('period') || 'month';

    // Get user's profile to check if they're an admin or manager
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, department_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
    }

    // Get the current date
    const now = new Date();

    // Determine date range based on period
    let startDate: Date;
    let endDate: Date;

    switch (period) {
      case 'month':
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
        break;
      case 'quarter':
        startDate = startOfQuarter(now);
        endDate = endOfQuarter(now);
        break;
      case 'year':
        startDate = startOfYear(now);
        endDate = endOfYear(now);
        break;
      case 'all':
        // For all time, use a fixed start date (e.g., beginning of the year)
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = now;
        break;
      default:
        startDate = startOfMonth(now);
        endDate = endOfMonth(now);
    }

    // Format dates for SQL query
    const formattedStartDate = format(startDate, 'yyyy-MM-dd');
    const formattedEndDate = format(endDate, 'yyyy-MM-dd');

    // Query attendance logs for the user within the date range
    const { data: logs, error: logsError } = await supabase
      .from('attendance_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('created_at', formattedStartDate)
      .lte('created_at', formattedEndDate)
      .order('created_at', { ascending: true });

    if (logsError) {
      return NextResponse.json({ error: 'Failed to fetch attendance logs' }, { status: 500 });
    }

    // Initialize adherence stats counters
    let early = 0;
    let on_time = 0;
    let late = 0;
    let absent = 0;
    let not_set = 0;

    // Group logs by date
    const logsByDate = new Map();

    logs.forEach(log => {
      const logDate = format(new Date(log.created_at), 'yyyy-MM-dd');

      if (!logsByDate.has(logDate)) {
        logsByDate.set(logDate, []);
      }

      logsByDate.get(logDate).push(log);
    });

    // Get adherence status from attendance_adherence table
    const dateRange = Array.from({ length: (endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000) + 1 },
      (_, i) => new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000));

    // Format dates for the query
    const formattedDates = dateRange.map(date => format(date, 'yyyy-MM-dd'));

    // Query attendance_adherence table for the user within the date range
    const { data: adherenceData, error: adherenceError } = await supabase
      .from('attendance_adherence')
      .select('status, date')
      .eq('user_id', user.id)
      .in('date', formattedDates);

    if (adherenceError) {
      console.error('Error fetching adherence data:', adherenceError);
      // Continue with empty adherence data
    }

    // Count adherence statuses
    if (adherenceData && adherenceData.length > 0) {
      adherenceData.forEach(record => {
        if (record.status === 'early') {
          early++;
        } else if (record.status === 'on_time') {
          on_time++;
        } else if (record.status === 'late') {
          late++;
        } else if (record.status === 'absent') {
          absent++;
        }
      });
    }

    // Count not_set as the difference between total days and days with status
    const daysWithStatus = early + on_time + late + absent;
    const totalDays = dateRange.length;
    not_set = totalDays - daysWithStatus;

    return NextResponse.json({
      early,
      on_time,
      late,
      absent,
      not_set
    });

  } catch (error) {
    console.error('Error in adherence stats API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
