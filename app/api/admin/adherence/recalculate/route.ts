import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { format, subDays, parseISO } from 'date-fns';

/**
 * API endpoint to recalculate adherence status for a date range
 * 
 * Required query parameters:
 * - startDate: ISO date string (YYYY-MM-DD)
 * - endDate: ISO date string (YYYY-MM-DD)
 * 
 * Optional query parameters:
 * - userId: UUID of specific user to recalculate (if not provided, recalculates for all users)
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }
    
    // Get request body
    const body = await request.json();
    const { startDate, endDate, userId } = body;
    
    // Validate dates
    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
    }
    
    try {
      // Parse and format dates to ensure they're valid
      const formattedStartDate = format(parseISO(startDate), 'yyyy-MM-dd');
      const formattedEndDate = format(parseISO(endDate), 'yyyy-MM-dd');
      
      // Call the recalculate_adherence function
      let result;
      
      if (userId) {
        // Recalculate for specific user
        const { data, error } = await supabase.rpc('recalculate_adherence_for_user', {
          p_user_id: userId,
          p_start_date: formattedStartDate,
          p_end_date: formattedEndDate
        });
        
        if (error) {
          console.error('Error recalculating adherence for user:', error);
          return NextResponse.json({ error: 'Failed to recalculate adherence' }, { status: 500 });
        }
        
        result = data;
      } else {
        // Recalculate for all users
        const { data, error } = await supabase.rpc('recalculate_adherence', {
          p_start_date: formattedStartDate,
          p_end_date: formattedEndDate
        });
        
        if (error) {
          console.error('Error recalculating adherence:', error);
          return NextResponse.json({ error: 'Failed to recalculate adherence' }, { status: 500 });
        }
        
        result = data;
      }
      
      return NextResponse.json({
        success: true,
        message: 'Adherence recalculation completed',
        result
      });
      
    } catch (dateError) {
      return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Error in adherence recalculation endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * GET endpoint to get recalculation status and recent updates
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (profileError || profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }
    
    // Get recent adherence updates (last 50)
    const { data: recentUpdates, error: updatesError } = await supabase
      .from('attendance_adherence')
      .select('id, user_id, date, status, updated_at, profiles(full_name)')
      .order('updated_at', { ascending: false })
      .limit(50);
      
    if (updatesError) {
      console.error('Error fetching recent adherence updates:', updatesError);
      return NextResponse.json({ error: 'Failed to fetch recent updates' }, { status: 500 });
    }
    
    // Get adherence statistics
    const { data: stats, error: statsError } = await supabase
      .from('attendance_adherence')
      .select('status, count')
      .eq('date', format(new Date(), 'yyyy-MM-dd'))
      .group('status');
      
    if (statsError) {
      console.error('Error fetching adherence statistics:', statsError);
      return NextResponse.json({ error: 'Failed to fetch adherence statistics' }, { status: 500 });
    }
    
    return NextResponse.json({
      recentUpdates,
      statistics: stats
    });
    
  } catch (error) {
    console.error('Error in adherence status endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
