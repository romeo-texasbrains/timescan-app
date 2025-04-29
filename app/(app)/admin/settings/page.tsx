'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { Database } from '@/lib/supabase/database.types'

// Define a type for settings based on the new table definition
type AppSettings = Database['public']['Tables']['app_settings']['Row']

// Server action for updating settings (placeholder)
async function updateSettings(formData: FormData) {
  'use server'

  const supabase = await createClient()

  // --- Authorization Check (Crucial!) ---
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return redirect('/login?message=Unauthorized')
  }
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || profile?.role !== 'admin') {
    return redirect('/?message=Unauthorized action')
  }
  // -------------------------------------

  const companyName = formData.get('company_name') as string
  const defaultHoursString = formData.get('default_hours') as string
  const defaultHours = parseFloat(defaultHoursString)

  // Validate parsed number
  if (isNaN(defaultHours) || defaultHours <= 0 || defaultHours > 24) {
    return redirect('/admin/settings?error=' + encodeURIComponent('Invalid default hours value.'))
  }

  // Implement actual database update logic using upsert
  const { error: upsertError } = await supabase
    .from('app_settings')
    .upsert({
      id: 1, // Target the specific row for global settings
      company_name: companyName,
      default_hours: defaultHours,
    })
    .eq('id', 1) // Condition for the upsert

  if (upsertError) {
    console.error("Error saving settings:", upsertError)
    return redirect('/admin/settings?error=' + encodeURIComponent(`Failed to save settings: ${upsertError.message}`))
  }

  // Redirect back with a success message
  redirect('/admin/settings?message=Settings saved successfully.')
}

interface SettingsPageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

export default async function AdminSettingsPage({ searchParams }: SettingsPageProps) {
  const supabase = await createClient()
  const awaitedSearchParams = await searchParams;
  const message = awaitedSearchParams?.message as string | undefined;
  const error = awaitedSearchParams?.error as string | undefined;

  // Fetch current settings from the database
  const { data: settingsData, error: fetchError } = await supabase
    .from('app_settings')
    .select('company_name, default_hours')
    .eq('id', 1) // Assuming settings are stored with id=1
    .maybeSingle<Pick<AppSettings, 'company_name' | 'default_hours'>>();

  if (fetchError) {
    console.error("Error fetching settings:", fetchError);
    // Display fetch error, but still render the form with defaults
    // You might want a more robust error display
  }

  // Use fetched settings or defaults
  const currentSettings = {
    companyName: settingsData?.company_name || 'Default Company Name',
    defaultHours: settingsData?.default_hours || 8,
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Application Settings</h1>
        <Link href="/admin">
          <Button variant="outline">Back to Admin</Button>
        </Link>
      </div>

      {/* Display Success/Error Messages */} 
      {message && (
        <div className="mb-4 p-3 bg-green-100 border border-green-300 text-green-800 rounded-md text-sm">
          <p><strong>Success:</strong> {decodeURIComponent(message)}</p>
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded-md text-sm">
          <p><strong>Error:</strong> {decodeURIComponent(error)}</p>
        </div>
      )}

      {fetchError && (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-md text-sm">
          <p><strong>Warning:</strong> Could not load current settings: {fetchError.message}. Displaying defaults.</p>
        </div>
      )}

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateSettings} className="space-y-6">
            {/* Company Name */} 
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                name="company_name"
                defaultValue={currentSettings.companyName ?? ''}
                required
              />
              <p className="text-sm text-gray-500">The name displayed throughout the application.</p>
            </div>

            {/* Default Work Hours */} 
            <div className="space-y-2">
              <Label htmlFor="default_hours">Default Work Hours per Day</Label>
              <Input
                id="default_hours"
                name="default_hours"
                type="number"
                defaultValue={currentSettings.defaultHours ?? 8}
                min="1"
                max="24"
                step="0.5"
                required
              />
              <p className="text-sm text-gray-500">Used for calculations like overtime (if implemented).</p>
            </div>

            {/* Add more settings fields here as needed */}
            {/* Example: Timezone, QR Code expiration, etc. */}

            <div className="flex justify-end pt-4">
              <Button type="submit">Save Settings</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
} 