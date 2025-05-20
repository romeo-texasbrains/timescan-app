import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { SupabaseClient } from '@supabase/supabase-js'

// Helper function to check if user is admin
async function checkIfAdmin(supabase: SupabaseClient): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile?.role === 'admin'
}

export async function GET() {
  const supabase = createClient()

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('timezone')
      .eq('id', 1)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching timezone:', error)
      throw new Error('Failed to fetch timezone setting')
    }

    const timezone = data?.timezone ?? 'UTC'
    return NextResponse.json({ timezone })

  } catch (error: any) {
    return NextResponse.json({ message: `Error fetching timezone: ${error.message}` }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const supabase = createClient()

  // Authentication and Authorization
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  // Check if user is admin
  const isAdmin = await checkIfAdmin(supabase)
  if (!isAdmin) {
     return NextResponse.json({ message: 'Forbidden: Admin access required' }, { status: 403 })
  }

  try {
    const { timezone } = await request.json()

    if (!timezone || typeof timezone !== 'string') {
      return NextResponse.json({ message: 'Bad Request: Invalid timezone provided' }, { status: 400 })
    }

    // Update app_settings table
    const { error: updateError } = await supabase
      .from('app_settings')
      .update({ timezone: timezone })
      .eq('id', 1)

    if (updateError) {
      console.error('Error updating timezone in app_settings:', updateError)
      throw new Error('Failed to update timezone in app_settings')
    }

    // Update settings table (for the SQL functions)
    const { error: settingsError } = await supabase
      .rpc('update_timezone_setting', { p_timezone: timezone })

    if (settingsError) {
      console.error('Error updating timezone in settings table:', settingsError)
      throw new Error('Failed to update timezone in settings table')
    }

    // Run the fix function to update existing records
    const { error: fixError } = await supabase
      .rpc('fix_adherence_status')

    if (fixError) {
      console.error('Error fixing adherence status:', fixError)
      // Continue anyway, as the timezone was updated successfully
    }

    return NextResponse.json({
      success: true,
      message: `Timezone updated to ${timezone}`
    })

  } catch (error: any) {
    return NextResponse.json({ message: `Error updating timezone: ${error.message}` }, { status: 500 })
  }
}