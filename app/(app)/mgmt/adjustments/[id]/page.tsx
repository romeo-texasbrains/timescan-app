import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'
import { updateAttendanceLog } from '@/app/actions/managerActions'

export default async function EditAttendanceLogPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  // --- Authorization Check ---
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return redirect('/login?message=Unauthorized')
  }
  
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || (profile?.role !== 'manager' && profile?.role !== 'admin')) {
    return redirect('/?message=Unauthorized access') // Redirect non-managers
  }

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

  if (error) {
    console.error('Error fetching log:', error)
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-destructive">
              Error: Could not find the requested attendance log.
            </div>
            <div className="flex justify-center mt-4">
              <Link href="/mgmt/adjustments">
                <Button variant="outline">Back to Adjustments</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Edit Attendance Log</h1>
        <Link href="/mgmt/adjustments">
          <Button variant="outline">Back to List</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance Log Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateAttendanceLog} className="space-y-6">
            {/* Hidden ID field */}
            <input type="hidden" name="id" value={log.id} />

            {/* Employee Info (non-editable) */}
            <div className="bg-muted/20 p-4 rounded-lg mb-4">
              <div className="font-medium">Employee</div>
              <div className="text-lg">{log.profiles?.full_name || 'Unknown'}</div>
              <div className="text-sm text-muted-foreground">{log.profiles?.email || 'No email'}</div>
            </div>

            {/* Timestamp */}
            <div>
              <Label htmlFor="timestamp" className="block text-sm font-medium mb-1">
                Timestamp
              </Label>
              <Input
                type="datetime-local"
                id="timestamp"
                name="timestamp"
                defaultValue={format(new Date(log.timestamp), "yyyy-MM-dd'T'HH:mm")}
                className="mt-1 block w-full"
              />
            </div>

            {/* Event Type */}
            <div>
              <Label htmlFor="event_type" className="block text-sm font-medium mb-1">
                Event Type
              </Label>
              <Select name="event_type" defaultValue={log.event_type}>
                <SelectTrigger id="event_type">
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="signin">Sign In</SelectItem>
                  <SelectItem value="signout">Sign Out</SelectItem>
                  <SelectItem value="break_start">Break Start</SelectItem>
                  <SelectItem value="break_end">Break End</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notes */}
            <div>
              <Label htmlFor="notes" className="block text-sm font-medium mb-1">
                Adjustment Notes
              </Label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                className="mt-1 block w-full rounded-md border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Reason for adjustment"
              ></textarea>
              <p className="text-xs text-muted-foreground mt-1">
                Please provide a reason for this adjustment for audit purposes.
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-4">
              <Link href="/mgmt/adjustments">
                <Button variant="outline" type="button">Cancel</Button>
              </Link>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
