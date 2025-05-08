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
    const { data: lastLog, error: lastLogError } = await supabase
      .from('attendance_logs')
      .select('event_type')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single()

    if (lastLogError && lastLogError.code !== 'PGRST116') {
      throw new Error(`Failed to get last attendance status: ${lastLogError.message}`)
    }

    const lastEventType = lastLog?.event_type

    // Validate state transitions
    if (action === 'start' && lastEventType !== 'signin') {
      return NextResponse.json({ 
        success: false, 
        message: 'You must be signed in to start a break.' 
      }, { status: 400 })
    }

    if (action === 'end' && lastEventType !== 'break_start') {
      return NextResponse.json({ 
        success: false, 
        message: 'You must be on break to end a break.' 
      }, { status: 400 })
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
