import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

// Server action for updating log
async function updateLog(formData: FormData) {
  'use server'
  
  const supabase = await createClient()
  const logId = formData.get('id') as string
  const timestamp = formData.get('timestamp') as string
  const eventType = formData.get('event_type') as string

  const { error } = await supabase
    .from('attendance_logs')
    .update({
      timestamp,
      event_type: eventType
    })
    .eq('id', logId)

  if (error) {
    throw new Error(`Failed to update log: ${error.message}`)
  }

  redirect('/admin')
}

export default async function EditAttendanceLogPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  // Fetch the log entry
  const { data: log, error } = await supabase
    .from('attendance_logs')
    .select(`
      *,
      profiles:user_id (
        full_name,
        email
      )
    `)
    .eq('id', params.id)
    .single()

  if (error || !log) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Card className="bg-red-50 border-red-200">
          <CardHeader>
            <CardTitle className="text-red-700">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">Failed to load attendance log: {error?.message || 'Log not found'}</p>
            <Link href="/admin" className="text-blue-600 hover:underline mt-4 inline-block">
              Return to Dashboard
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  const profile = Array.isArray(log.profiles) ? log.profiles[0] : log.profiles

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Edit Attendance Log</h1>
        <Link href="/admin">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Log Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateLog} className="space-y-4">
            <input type="hidden" name="id" value={log.id} />
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employee
              </label>
              <p className="text-gray-900">{profile?.full_name || 'Unknown'}</p>
              <p className="text-sm text-gray-500">{profile?.email || '-'}</p>
            </div>

            <div>
              <label htmlFor="timestamp" className="block text-sm font-medium text-gray-700 mb-1">
                Timestamp
              </label>
              <input
                type="datetime-local"
                id="timestamp"
                name="timestamp"
                defaultValue={format(new Date(log.timestamp), "yyyy-MM-dd'T'HH:mm")}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label htmlFor="event_type" className="block text-sm font-medium text-gray-700 mb-1">
                Event Type
              </label>
              <select
                id="event_type"
                name="event_type"
                defaultValue={log.event_type}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              >
                <option value="signin">Sign In</option>
                <option value="signout">Sign Out</option>
              </select>
            </div>

            <div className="flex justify-end space-x-3">
              <Link href="/admin">
                <Button type="button" variant="outline">Cancel</Button>
              </Link>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}