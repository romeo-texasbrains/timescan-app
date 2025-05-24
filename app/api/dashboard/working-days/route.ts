import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { format, startOfMonth, endOfMonth, getDaysInMonth, getDay, isWeekend, addDays } from 'date-fns';
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
        totalDays: 21,
        workedDays: 15
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

    // Calculate total working days in the period (excluding weekends)
    let totalDays = 0;
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      if (!isWeekend(currentDate)) {
        totalDays++;
      }
      currentDate = addDays(currentDate, 1);
    }

    // Calculate days worked (days with at least one attendance log)
    const uniqueDates = new Set();
    logs.forEach(log => {
      const logDate = format(new Date(log.created_at), 'yyyy-MM-dd');
      uniqueDates.add(logDate);
    });

    const workedDays = uniqueDates.size;

    return NextResponse.json({
      totalDays,
      workedDays
    });

  } catch (error) {
    console.error('Error in working days API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
