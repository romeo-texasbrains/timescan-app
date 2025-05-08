import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { updateDepartment } from '@/app/actions/adminActions'

export default async function EditDepartmentPage({ params }: { params: { id: string } }) {
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
  
  // Fetch department
  const { data: department, error: departmentError } = await supabase
    .from('departments')
    .select('*')
    .eq('id', params.id)
    .single()
  
  if (departmentError) {
    console.error('Error fetching department:', departmentError)
    redirect('/admin/departments')
  }
  
  // Fetch employees in this department
  const { data: employees, error: employeesError } = await supabase
    .from('profiles')
    .select('id, full_name, email, role')
    .eq('department_id', params.id)
    .order('full_name')
  
  if (employeesError) {
    console.error('Error fetching employees:', employeesError)
  }
  
  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Edit Department</h1>
        <Link href="/admin/departments">
          <Button variant="outline">Back to Departments</Button>
        </Link>
      </div>
      
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Department Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateDepartment} className="space-y-6">
            <input type="hidden" name="id" value={department.id} />
            
            <div className="space-y-2">
              <Label htmlFor="name">Department Name</Label>
              <Input 
                id="name" 
                name="name" 
                defaultValue={department.name} 
                required 
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea 
                id="description" 
                name="description" 
                defaultValue={department.description || ''} 
                rows={4} 
              />
            </div>
            
            <div className="flex justify-end gap-2">
              <Link href="/admin/departments">
                <Button variant="outline" type="button">Cancel</Button>
              </Link>
              <Button type="submit">Update Department</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Department Members ({employees?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {employees && employees.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Email</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map(employee => (
                    <tr key={employee.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{employee.full_name || 'Unnamed'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{employee.email}</td>
                      <td className="px-4 py-3 text-muted-foreground capitalize">{employee.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-center py-4 text-muted-foreground">No employees in this department</p>
          )}
        </CardContent>
        <CardFooter className="flex justify-end border-t pt-4">
          <Link href="/admin/employees">
            <Button variant="outline" size="sm">
              Manage Employees
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
