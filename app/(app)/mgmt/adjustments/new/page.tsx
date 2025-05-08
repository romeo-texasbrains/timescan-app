import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'
import { createAttendanceLog } from '@/app/actions/managerActions'

export default async function NewAttendanceLogPage() {
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

  // Get employees for dropdown
  const { data: employees, error: employeesError } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .order('full_name')

  if (employeesError) {
    console.error('Error fetching employees:', employeesError)
  }

  // Get current date and time for default values
  const now = new Date()
  const defaultDateTime = now.toISOString().slice(0, 16) // Format: YYYY-MM-DDTHH:MM

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Add New Attendance Log</h1>
        <Link href="/mgmt/adjustments">
          <Button variant="outline">Back to List</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Attendance Log</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createAttendanceLog} className="space-y-6">
            {/* Employee Selection */}
            <div>
              <Label htmlFor="user_id" className="block text-sm font-medium mb-1">
                Employee
              </Label>
              <Select name="user_id" required>
                <SelectTrigger id="user_id">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees?.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name || 'Unnamed'} ({emp.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                defaultValue={defaultDateTime}
                className="mt-1 block w-full"
                required
              />
            </div>

            {/* Event Type */}
            <div>
              <Label htmlFor="event_type" className="block text-sm font-medium mb-1">
                Event Type
              </Label>
              <Select name="event_type" required>
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
                placeholder="Reason for manual entry"
                required
              ></textarea>
              <p className="text-xs text-muted-foreground mt-1">
                Please provide a reason for this manual entry for audit purposes.
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-4">
              <Link href="/mgmt/adjustments">
                <Button variant="outline" type="button">Cancel</Button>
              </Link>
              <Button type="submit">Create Log</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
