import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'
import { Database } from '@/lib/supabase/database.types'

type Profile = Database['public']['Tables']['profiles']['Row'];
type Role = Database['public']['Enums']['user_role'];

// Server action for updating profile
async function updateProfile(formData: FormData) {
  'use server'

  const supabase = await createClient()
  const profileId = formData.get('id') as string
  const fullName = formData.get('full_name') as string
  const role = formData.get('role') as Role
  const departmentId = formData.get('department_id') as string || null
  // Construct the path for redirecting back to the edit page
  const currentPath = `/admin/employees/${profileId}`

  if (!profileId || !fullName || !role) {
    // Redirect back to the edit page with an error message
    redirect(`${currentPath}?error=${encodeURIComponent('Missing required form fields.')}`)
    return // Stop execution after redirect
  }

  // Note: Email cannot be updated here as it's tied to Supabase Auth user.
  // Password changes would require a separate flow (e.g., admin password reset).
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      role: role,
      department_id: departmentId === 'null' ? null : departmentId,
    })
    .eq('id', profileId)

  if (error) {
    console.error("Error updating profile:", error)
    // Redirect back to the edit page with the database error message
    redirect(`${currentPath}?error=${encodeURIComponent(`Failed to update profile: ${error.message}`)}`)
    return // Stop execution after redirect
  }

  // Also update the user_roles table to keep it in sync
  try {
    // First check if the user already has an entry in user_roles
    const { data: existingUserRole, error: checkError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('user_id', profileId)
      .maybeSingle();

    if (checkError) {
      console.warn(`Error checking user_roles for profile ${profileId}: ${checkError.message}`);
    }

    // If no entry exists, create one
    if (!existingUserRole) {
      // Insert into user_roles
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({
          user_id: profileId,
          role: role,
          department_id: departmentId === 'null' ? null : departmentId
        });

      if (insertError) {
        console.warn(`Error creating user_roles entry for profile ${profileId}: ${insertError.message}`);
      } else {
        console.log(`Successfully created user_roles entry for profile ${profileId}`);
      }
    } else {
      // Update existing user_role
      const { error: updateError } = await supabase
        .from('user_roles')
        .update({
          role: role,
          department_id: departmentId === 'null' ? null : departmentId,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', profileId);

      if (updateError) {
        console.warn(`Error updating user_roles for profile ${profileId}: ${updateError.message}`);
      } else {
        console.log(`Successfully updated user_roles for profile ${profileId}`);
      }
    }
  } catch (error) {
    console.warn(`Unexpected error handling user_roles for profile ${profileId}:`, error);
  }

  // Redirect back to the employees list after successful update with a success message
  redirect('/admin/employees?message=Profile updated successfully.')
}

// Update component signature to accept searchParams
// Define the expected structure of params
interface EditEmployeePageProps {
  params: { id: string };
  searchParams?: { [key: string]: string | string[] | undefined }; // Add searchParams here
}

// Modify the component function signature
export default async function EditEmployeePage({ params, searchParams }: EditEmployeePageProps) {
  const supabase = await createClient()
  const awaitedParams = await params;
  const profileId = awaitedParams.id;

  // Await searchParams before accessing its properties
  const awaitedSearchParams = await searchParams;
  const errorMessage = awaitedSearchParams?.error as string | undefined;

  // Fetch the employee profile
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('*') // Select all profile fields
    .eq('id', profileId)
    .single<Profile>() // Expect a single result

  // Fetch departments for dropdown
  const { data: departments, error: departmentsError } = await supabase
    .from('departments')
    .select('id, name')
    .order('name')

  if (departmentsError) {
    console.error("Error fetching departments:", departmentsError)
  }

  if (fetchError || !profile) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Card className="bg-red-50 border-red-200">
          <CardHeader>
            <CardTitle className="text-red-700">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">Failed to load employee profile: {fetchError?.message || 'Profile not found'}</p>
            <Link href="/admin/employees" className="text-blue-600 hover:underline mt-4 inline-block">
              Return to Employee List
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Edit Employee Profile</h1>
        <Link href="/admin/employees">
          <Button variant="outline">Back to List</Button>
        </Link>
      </div>

      {/* Display Server Action Error Message if present */}
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-800 rounded-md text-sm">
          <p><strong>Update Error:</strong> {decodeURIComponent(errorMessage)}</p>
        </div>
      )}

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Profile Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateProfile} className="space-y-6">
            <input type="hidden" name="id" value={profile.id} />

            {/* Email (Read-only) */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={profile.email || ''}
                readOnly
                disabled
                className="bg-gray-100 cursor-not-allowed"
              />
              <p className="text-sm text-gray-500">Email cannot be changed.</p>
            </div>

            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                name="full_name"
                defaultValue={profile.full_name || ''}
                required
              />
            </div>

            {/* Role */}
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select name="role" defaultValue={profile.role || 'employee'} required>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Department */}
            <div className="space-y-2">
              <Label htmlFor="department_id">Department</Label>
              <Select name="department_id" defaultValue={profile.department_id || 'null'}>
                <SelectTrigger id="department_id">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">No Department</SelectItem>
                  {departments?.map(dept => (
                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Link href="/admin/employees">
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