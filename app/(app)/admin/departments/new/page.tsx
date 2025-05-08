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
            
            <div className="flex justify-end gap-2">
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
