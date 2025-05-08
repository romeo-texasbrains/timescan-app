import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline'
import { createDepartment, deleteDepartment } from '@/app/actions/adminActions'

export default async function DepartmentsPage() {
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

  // Fetch departments
  const { data: departments, error: departmentsError } = await supabase
    .from('departments')
    .select('*')
    .order('name')

  if (departmentsError) {
    console.error('Error fetching departments:', departmentsError)
  }

  // Fetch employee counts per department
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('department_id')

  if (profilesError) {
    console.error('Error fetching profiles:', profilesError)
  }

  // Count employees per department
  const departmentCounts: Record<string, number> = {}

  profiles?.forEach(profile => {
    if (profile.department_id) {
      departmentCounts[profile.department_id] = (departmentCounts[profile.department_id] || 0) + 1
    }
  })

  return (
    <div className="container mx-auto p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Departments</h1>
        <Link href="/admin/departments/new" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto touch-manipulation active:scale-95 transition-transform">
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Department
          </Button>
        </Link>
      </div>

      {departments && departments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {departments.map(department => (
            <Card key={department.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle>{department.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {department.description || 'No description'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  <div className="flex justify-between mb-2">
                    <span>Employees:</span>
                    <span className="font-medium">{departmentCounts[department.id] || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span>{format(new Date(department.created_at), 'MMM d, yyyy')}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col xs:flex-row xs:justify-end gap-2 border-t pt-4">
                <form action={deleteDepartment} className="w-full xs:w-auto">
                  <input type="hidden" name="id" value={department.id} />
                  <Button
                    variant="destructive"
                    size="sm"
                    type="submit"
                    className="w-full xs:w-auto touch-manipulation active:scale-95 transition-transform"
                  >
                    <TrashIcon className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </form>
                <Link href={`/admin/departments/${department.id}`} className="w-full xs:w-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full xs:w-auto touch-manipulation active:scale-95 transition-transform"
                  >
                    <PencilIcon className="h-4 w-4 mr-1" />
                    Edit
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
            <p className="text-muted-foreground mb-4">No departments found</p>
            <Link href="/admin/departments/new" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto touch-manipulation active:scale-95 transition-transform">
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Department
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
