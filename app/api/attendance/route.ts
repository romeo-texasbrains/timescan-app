import { createClient } from '@/lib/supabase/server'
import { Database } from '@/lib/supabase/database.types'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

type AttendanceLog = Database['public']['Tables']['attendance_logs']['Row']
type AttendanceEventType = Database['public']['Enums']['attendance_event_type']

// Define the expected prefix for valid QR codes
const VALID_QR_PREFIX = "TIMESCAN-LOC:";

// Define the manual punch code (used from dashboard)
const MANUAL_PUNCH_CODE = "TIMESCAN-LOC:manual_dashboard_punch";

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
  let qrCodeData: string | null = null
  try {
    const body = await request.json()
    qrCodeData = body.qrCodeData

    // Validation Checks:
    if (!qrCodeData) {
      throw new Error('Missing qrCodeData in request body');
    }
    if (typeof qrCodeData !== 'string') {
      throw new Error('Invalid qrCodeData format: must be a string');
    }

    // Check if this is a manual punch from the dashboard
    const isManualPunch = qrCodeData === MANUAL_PUNCH_CODE;

    // If not a manual punch, validate QR code format
    if (!isManualPunch && !qrCodeData.startsWith(VALID_QR_PREFIX)) {
      throw new Error(`Invalid QR code format. Expected prefix: ${VALID_QR_PREFIX}`);
    }

    // Optional: Extract location data if needed
    // const location = qrCodeData.substring(VALID_QR_PREFIX.length);
    // if (!location) { throw new Error('Missing location data in QR code'); }

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
    // Check if this is a manual punch from the dashboard
    const isManualPunch = qrCodeData === MANUAL_PUNCH_CODE;

    // 3. Determine Event Type (Sign-in or Sign-out)
    const { data: lastLog, error: lastLogError } = await supabase
      .from('attendance_logs')
      .select('event_type, timestamp')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single<Pick<AttendanceLog, 'event_type' | 'timestamp'>>() // Use Pick for type safety

    if (lastLogError && lastLogError.code !== 'PGRST116') { // PGRST116 = 'Exactly one row expected but 0 rows returned'
      // Handle unexpected errors fetching last log
      throw new Error(`Failed to get last attendance status: ${lastLogError.message}`)
    }

    let nextEventType: AttendanceEventType = 'signin'; // Default to signin if no previous log

    // For manual punches, only allow signout
    if (isManualPunch) {
      // Manual punches can only be used for signout
      nextEventType = 'signout';

      // Log the current state for debugging
      if (!lastLog) {
        console.warn(`Manual punch out requested by user ${user.email} with no previous logs.`);
      } else if (lastLog.event_type !== 'signin') {
        console.warn(`Manual punch out requested by user ${user.email} but last event was ${lastLog.event_type}.`);
      } else {
        console.log(`Manual punch out requested by user ${user.email}`);
      }

      // Always allow manual punch out, even if the system thinks the user isn't signed in
      // This helps resolve UI/server state mismatches

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
      } else {
        console.log(`Found ${todayLogs?.length || 0} logs for today:`,
          todayLogs?.map(log => `${log.event_type} at ${new Date(log.timestamp).toLocaleTimeString()}`));

        // Determine if user is actually signed in by analyzing the sequence of events
        let isCurrentlySignedIn = false;

        if (todayLogs && todayLogs.length > 0) {
          // Process the logs to determine current state
          for (const log of todayLogs) {
            if (log.event_type === 'signin') {
              isCurrentlySignedIn = true;
            } else if (log.event_type === 'signout') {
              isCurrentlySignedIn = false;
            }
            // Break events don't affect signed-in status
          }

          console.log(`Attendance API: Current state - Signed in: ${isCurrentlySignedIn}`);

          // If user is not actually signed in, we might want to add a note to the response
          if (!isCurrentlySignedIn) {
            console.log(`User ${user.email} is not actually signed in according to log sequence analysis.`);
          }
        }
      }
    }
    // For QR code scans, determine event type based on last log
    else if (lastLog) {
      const lastEventType = lastLog.event_type;
      const lastTimestamp = new Date(lastLog.timestamp);
      const now = new Date();

      // Check if the last event was on a different day
      const isSameDay =
        lastTimestamp.getFullYear() === now.getFullYear() &&
        lastTimestamp.getMonth() === now.getMonth() &&
        lastTimestamp.getDate() === now.getDate();

      if (isSameDay) {
        // If same day, toggle between signin and signout
        nextEventType = (lastEventType === 'signin') ? 'signout' : 'signin';
      } else {
        // If different day, always start with signin
        nextEventType = 'signin';

        // If the last event was a signin without a signout, log a warning
        if (lastEventType === 'signin') {
          console.warn(`User ${user.email} had an unclosed signin from ${lastTimestamp.toISOString()}. Starting a new signin.`);
        }
      }
    }

    // 4. Insert New Attendance Log
    const { error: insertError } = await supabase
      .from('attendance_logs')
      .insert({
        user_id: user.id,
        event_type: nextEventType,
        // timestamp is handled by default value in DB
        // created_at is handled by default value in DB
      })

    if (insertError) {
      throw new Error(`Failed to record attendance: ${insertError.message}`)
    }

    // 5. Return Success Response
    console.log(`User ${user.email} recorded: ${nextEventType}`)

    // Add more context to the message if needed
    let message = '';

    // Different messages for manual punches vs QR scans
    if (isManualPunch) {
      // For manual punch-outs, provide more context based on the last log
      if (!lastLog) {
        message = `Successfully punched out via dashboard. Note: No previous sign-in record was found.`;
      } else if (lastLog.event_type !== 'signin') {
        message = `Successfully punched out via dashboard. Note: Your last recorded action was "${lastLog.event_type}".`;
      } else {
        message = `Successfully punched out via dashboard.`;
      }

      // Add a timestamp to help with debugging
      const now = new Date();
      message += ` (${now.toLocaleTimeString()})`;
    } else {
      message = `Successfully recorded ${nextEventType}.`;

      if (lastLog && lastLog.event_type === 'signin' && nextEventType === 'signin') {
        const lastTimestamp = new Date(lastLog.timestamp);
        const formattedDate = lastTimestamp.toLocaleDateString();
        message = `Successfully recorded ${nextEventType}. Note: Your previous signin on ${formattedDate} was not closed with a signout.`;
      }
    }

    return NextResponse.json({
      success: true,
      eventType: nextEventType,
      message: message
    })

  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error(`API Error recording attendance for ${user.email}:`, error)
      return NextResponse.json({ message: `Internal Server Error: ${error.message}` }, { status: 500 })
    } else {
      console.error(`API Error recording attendance for ${user.email}: Unknown error`)
      return NextResponse.json({ message: 'Internal Server Error: Unknown error' }, { status: 500 })
    }
  }
}
