import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createDepartment } from '@/app/actions/adminActions'

export default async function NewDepartmentPage() {
  const supabase = await createClient()

  // Check if user is admin
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || profile?.role !== 'admin') {
    redirect('/')
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Add Department</h1>
        <Link href="/admin/departments">
          <Button variant="outline">Cancel</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Department Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createDepartment} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Department Name</Label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. Engineering"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Describe the department's function and responsibilities"
                rows={4}
              />
            </div>

            <div className="border-t pt-4 mt-4">
              <h3 className="text-lg font-medium mb-4">Shift Settings</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="shift_start_time">Shift Start Time</Label>
                  <Input
                    id="shift_start_time"
                    name="shift_start_time"
                    type="time"
                    defaultValue="09:00"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    The scheduled start time for shifts in this department
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shift_end_time">Shift End Time</Label>
                  <Input
                    id="shift_end_time"
                    name="shift_end_time"
                    type="time"
                    defaultValue="17:00"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    The scheduled end time for shifts in this department
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="grace_period_minutes">Grace Period (minutes)</Label>
                <Input
                  id="grace_period_minutes"
                  name="grace_period_minutes"
                  type="number"
                  min="0"
                  max="60"
                  defaultValue="30"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Minutes after shift start time before an employee is marked late (default: 30)
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Link href="/admin/departments">
                <Button variant="outline" type="button">Cancel</Button>
              </Link>
              <Button type="submit">Create Department</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
