import { createClient } from '@/lib/supabase/server'
import { Database } from '@/lib/supabase/database.types'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

type AttendanceLog = Database['public']['Tables']['attendance_logs']['Row']
type AttendanceEventType = Database['public']['Enums']['attendance_event_type']

// Define the expected prefix for valid QR codes
const VALID_QR_PREFIX = "TIMESCAN-LOC:";

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
    if (!qrCodeData.startsWith(VALID_QR_PREFIX)) {
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
    // 3. Determine Event Type (Sign-in or Sign-out)
    const { data: lastLog, error: lastLogError } = await supabase
      .from('attendance_logs')
      .select('event_type')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single<Pick<AttendanceLog, 'event_type'>>() // Use Pick for type safety

    if (lastLogError && lastLogError.code !== 'PGRST116') { // PGRST116 = 'Exactly one row expected but 0 rows returned'
      // Handle unexpected errors fetching last log
      throw new Error(`Failed to get last attendance status: ${lastLogError.message}`)
    }

    const lastEventType = lastLog?.event_type
    const nextEventType: AttendanceEventType = (lastEventType === 'signin') ? 'signout' : 'signin'

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
    return NextResponse.json({ success: true, eventType: nextEventType, message: `Successfully recorded ${nextEventType}.` })

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
