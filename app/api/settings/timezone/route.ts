import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { SupabaseClient } from '@supabase/supabase-js' // Import type if needed

// IMPORTANT: Replace this with your actual admin check logic
async function checkIfAdmin(supabase: SupabaseClient): Promise<boolean> {
  // Example: Check for a specific role or custom claim
  // const { data: { user } } = await supabase.auth.getUser();
  // const { data: profile, error } = await supabase.from('profiles').select('is_admin').eq('id', user?.id).single();
  // return profile?.is_admin ?? false;

  // For now, allowing any authenticated user for simplicity. SECURE THIS PROPERLY!
  const { data: { user } } = await supabase.auth.getUser();
  return !!user;
}

export async function GET() {
  const cookieStore = cookies()
  const supabase = await createClient() // Await the server client creation

  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('timezone')
      .eq('id', 1) // Assuming single row for settings
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116: row not found is ok, we'll use default
      console.error('Error fetching timezone:', error)
      throw new Error('Failed to fetch timezone setting')
    }

    const timezone = data?.timezone ?? 'UTC' // Default to UTC if not set
    return NextResponse.json({ timezone })

  } catch (error: any) {
    return NextResponse.json({ message: `Error fetching timezone: ${error.message}` }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const cookieStore = cookies()
  const supabase = await createClient() // Await the server client creation

  // Authentication and Authorization
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  }

  // Replace with your actual admin check
  const isAdmin = await checkIfAdmin(supabase); // Pass the awaited client instance
  if (!isAdmin) {
     return NextResponse.json({ message: 'Forbidden: Admin access required' }, { status: 403 })
  }

  try {
    const { timezone } = await request.json()

    if (!timezone || typeof timezone !== 'string') {
      return NextResponse.json({ message: 'Bad Request: Invalid timezone provided' }, { status: 400 })
    }

    // Optional: Validate if timezone is a valid IANA identifier (can be complex)
    // try {
    //   Intl.DateTimeFormat(undefined, { timeZone: timezone });
    // } catch (e) {
    //   return NextResponse.json({ message: 'Bad Request: Invalid IANA timezone identifier' }, { status: 400 })
    // }

    const { error: updateError } = await supabase
      .from('app_settings')
      .update({ timezone: timezone })
      .eq('id', 1) // Update the single settings row

    if (updateError) {
      console.error('Error updating timezone:', updateError)
      throw new Error('Failed to update timezone setting')
    }

    return NextResponse.json({ success: true, message: `Timezone updated to ${timezone}` })

  } catch (error: any) {
    return NextResponse.json({ message: `Error updating timezone: ${error.message}` }, { status: 500 })
  }
} 