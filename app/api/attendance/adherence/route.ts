import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET endpoint to fetch adherence status for a user on a specific date
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get('userId');
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]; // Default to today
  
  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }
  
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get the user's role and department
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, department_id')
      .eq('id', user.id)
      .single();
      
    if (profileError) {
      return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
    }
    
    // Check if user has permission to view this adherence data
    const isAdmin = profile.role === 'admin';
    const isManager = profile.role === 'manager';
    const isSelf = user.id === userId;
    
    if (!isAdmin && !isManager && !isSelf) {
      return NextResponse.json({ error: 'Unauthorized to view this adherence data' }, { status: 403 });
    }
    
    // If manager, check if the requested user is in their department
    if (isManager && !isSelf) {
      const { data: targetUser, error: targetUserError } = await supabase
        .from('profiles')
        .select('department_id')
        .eq('id', userId)
        .single();
        
      if (targetUserError) {
        return NextResponse.json({ error: 'Failed to fetch target user profile' }, { status: 500 });
      }
      
      if (targetUser.department_id !== profile.department_id) {
        return NextResponse.json({ error: 'Unauthorized to view adherence data for users outside your department' }, { status: 403 });
      }
    }
    
    // Fetch adherence data
    const { data: adherence, error: adherenceError } = await supabase
      .from('attendance_adherence')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .single();
      
    if (adherenceError && adherenceError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      return NextResponse.json({ error: 'Failed to fetch adherence data' }, { status: 500 });
    }
    
    // If no adherence record exists, calculate it on-the-fly
    if (!adherence) {
      // Call the database function to calculate adherence status
      const { data: calculatedStatus, error: calcError } = await supabase
        .rpc('calculate_adherence_status', {
          p_user_id: userId,
          p_date: date
        });
        
      if (calcError) {
        return NextResponse.json({ error: 'Failed to calculate adherence status' }, { status: 500 });
      }
      
      // Check if eligible for absent marking
      const { data: eligibility, error: eligibilityError } = await supabase
        .rpc('check_absent_eligibility', {
          p_user_id: userId,
          p_date: date
        });
        
      if (eligibilityError) {
        return NextResponse.json({ error: 'Failed to check absent eligibility' }, { status: 500 });
      }
      
      return NextResponse.json({ 
        status: calculatedStatus,
        eligible_for_absent: eligibility,
        date
      });
    }
    
    // Return the existing adherence record
    return NextResponse.json(adherence);
  } catch (error) {
    console.error('Error in adherence GET endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST endpoint to mark a user as absent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, date, markAbsent } = body;
    
    if (!userId || !date) {
      return NextResponse.json({ error: 'User ID and date are required' }, { status: 400 });
    }
    
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get the user's role and department
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, department_id')
      .eq('id', user.id)
      .single();
      
    if (profileError) {
      return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
    }
    
    // Check if user has permission to mark absences
    const isAdmin = profile.role === 'admin';
    const isManager = profile.role === 'manager';
    
    if (!isAdmin && !isManager) {
      return NextResponse.json({ error: 'Unauthorized to mark absences' }, { status: 403 });
    }
    
    // If manager, check if the target user is in their department
    if (isManager) {
      const { data: targetUser, error: targetUserError } = await supabase
        .from('profiles')
        .select('department_id')
        .eq('id', userId)
        .single();
        
      if (targetUserError) {
        return NextResponse.json({ error: 'Failed to fetch target user profile' }, { status: 500 });
      }
      
      if (targetUser.department_id !== profile.department_id) {
        return NextResponse.json({ error: 'Unauthorized to mark absences for users outside your department' }, { status: 403 });
      }
    }
    
    // Check if the user is eligible to be marked absent
    if (markAbsent) {
      const { data: eligibility, error: eligibilityError } = await supabase
        .rpc('check_absent_eligibility', {
          p_user_id: userId,
          p_date: date
        });
        
      if (eligibilityError) {
        return NextResponse.json({ error: 'Failed to check absent eligibility' }, { status: 500 });
      }
      
      if (!eligibility) {
        return NextResponse.json({ error: 'User is not eligible to be marked absent' }, { status: 400 });
      }
    }
    
    // Update or insert the adherence record
    const { data, error } = await supabase
      .from('attendance_adherence')
      .upsert({
        user_id: userId,
        date,
        status: markAbsent ? 'absent' : 'late', // If not marking absent, revert to late
        marked_by: user.id,
        updated_at: new Date().toISOString()
      });
      
    if (error) {
      return NextResponse.json({ error: 'Failed to update adherence status' }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: markAbsent ? 'User marked as absent' : 'User marked as late',
      status: markAbsent ? 'absent' : 'late'
    });
  } catch (error) {
    console.error('Error in adherence POST endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
