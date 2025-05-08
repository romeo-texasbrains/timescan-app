import { createClient } from '@/lib/supabase/server'
import { Database } from '@/lib/supabase/database.types'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

type AttendanceLog = Database['public']['Tables']['attendance_logs']['Row']
type AttendanceEventType = Database['public']['Enums']['attendance_event_type']

export async function POST(request: Request) {
  const cookieStore = await cookies()
  const supabase = await createClient()

  // 1. Check Authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    console.error('API Auth Error:', authError)
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse and VALIDATE Request Body
  let action: 'start' | 'end' | null = null
  try {
    const body = await request.json()
    action = body.action

    // Validation Checks:
    if (!action) {
      throw new Error('Missing action in request body');
    }
    if (action !== 'start' && action !== 'end') {
      throw new Error('Invalid action: must be "start" or "end"');
    }

  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error('API Body Parse/Validation Error:', error)
      return NextResponse.json({ message: `Bad Request: ${error.message}` }, { status: 400 })
    } else {
      console.error('API Body Parse/Validation Error: Unknown error')
      return NextResponse.json({ message: 'Bad Request: Unknown error' }, { status: 400 })
    }
  }

  try {
    // 3. Determine Event Type based on action
    const eventType: string = action === 'start' ? 'break_start' : 'break_end'

    // 4. Check if user is signed in before allowing break
    console.log(`Break API: User ${user.email} attempting to ${action} break.`);

    // Get all of today's logs for the user to determine their current state
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

    const { data: todayLogs, error: todayLogsError } = await supabase
      .from('attendance_logs')
      .select('id, event_type, timestamp')
      .eq('user_id', user.id)
      .gte('timestamp', todayStart)
      .order('timestamp', { ascending: true });

    if (todayLogsError) {
      console.error(`Failed to get today's logs: ${todayLogsError.message}`);
      throw new Error(`Failed to get attendance logs: ${todayLogsError.message}`);
    }

    console.log(`Break API: Found ${todayLogs?.length || 0} logs for today:`,
      todayLogs?.map(log => `${log.event_type} at ${new Date(log.timestamp).toLocaleTimeString()}`) || []);

    // Get the last log regardless of date to handle edge cases
    const { data: lastLog, error: lastLogError } = await supabase
      .from('attendance_logs')
      .select('event_type, timestamp')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (lastLogError && lastLogError.code !== 'PGRST116') {
      throw new Error(`Failed to get last attendance status: ${lastLogError.message}`);
    }

    const lastEventType = lastLog?.event_type;

    console.log(`Break API: Last event type (any date): ${lastEventType || 'none'}`);

    // Determine if the user is currently signed in by analyzing the sequence of events
    let isCurrentlySignedIn = false;
    let isOnBreak = false;

    if (todayLogs && todayLogs.length > 0) {
      // Process the logs to determine current state
      for (const log of todayLogs) {
        if (log.event_type === 'signin') {
          isCurrentlySignedIn = true;
          isOnBreak = false;
        } else if (log.event_type === 'signout') {
          isCurrentlySignedIn = false;
          isOnBreak = false;
        } else if (log.event_type === 'break_start') {
          isOnBreak = true;
        } else if (log.event_type === 'break_end') {
          isOnBreak = false;
        }
      }

      console.log(`Break API: Current state - Signed in: ${isCurrentlySignedIn}, On break: ${isOnBreak}`);
    } else {
      console.log(`Break API: No logs found for today. User is not signed in.`);
    }

    // For break start, check if user is currently signed in
    if (action === 'start') {
      // If user is not signed in according to our state tracking
      if (!isCurrentlySignedIn) {
        return NextResponse.json({
          success: false,
          message: 'You must punch in before starting a break.'
        }, { status: 400 });
      }

      // If user is already on break
      if (isOnBreak) {
        return NextResponse.json({
          success: false,
          message: 'You are already on break. End your current break before starting a new one.'
        }, { status: 400 });
      }

      // Additional safety check - if the last event is not what we expect
      if (todayLogs && todayLogs.length > 0) {
        const lastTodayLog = todayLogs[todayLogs.length - 1];
        if (lastTodayLog.event_type !== 'signin' && lastTodayLog.event_type !== 'break_end') {
          console.log(`Break API: Warning - Last event (${lastTodayLog.event_type}) is not signin or break_end, but allowing break start because user appears to be signed in.`);
        }
      }
    }

    // For break end, check if the user is currently on break
    if (action === 'end') {
      if (!isOnBreak) {
        return NextResponse.json({
          success: false,
          message: 'You must be on break to end a break.'
        }, { status: 400 })
      }

      // Additional safety check - if the last event is not what we expect
      if (todayLogs && todayLogs.length > 0) {
        const lastTodayLog = todayLogs[todayLogs.length - 1];
        if (lastTodayLog.event_type !== 'break_start') {
          console.log(`Break API: Warning - Last event (${lastTodayLog.event_type}) is not break_start, but allowing break end because user appears to be on break.`);
        }
      }
    }

    // 5. Insert New Attendance Log
    const { error: insertError } = await supabase
      .from('attendance_logs')
      .insert({
        user_id: user.id,
        event_type: eventType,
        // timestamp is handled by default value in DB
        // created_at is handled by default value in DB
      })

    if (insertError) {
      throw new Error(`Failed to record break: ${insertError.message}`)
    }

    // 6. Return Success Response
    console.log(`User ${user.email} recorded: ${eventType}`)
    return NextResponse.json({
      success: true,
      eventType: eventType,
      message: action === 'start' ? 'Break started successfully.' : 'Break ended successfully.'
    })

  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(`API Error recording break for ${user.email}:`, error)
      return NextResponse.json({ message: `Internal Server Error: ${error.message}` }, { status: 500 })
    } else {
      console.error(`API Error recording break for ${user.email}: Unknown error`)
      return NextResponse.json({ message: 'Internal Server Error: Unknown error' }, { status: 500 })
    }
  }
}
