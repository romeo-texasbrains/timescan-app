import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import ManagerProfileEditForm from '@/components/manager/ManagerProfileEditForm';

type Params = {
  id: string;
};

export default async function ManagerEmployeeProfilePage({
  params,
}: {
  params: Params;
}) {
  // Await params before using its properties
  const awaitedParams = await params;
  const id = awaitedParams.id;
  const supabase = await createClient();

  // Check if user is logged in
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return redirect('/login?message=Please log in to access this page');
  }

  // Get user role and department
  const { data: userRoles, error: roleError } = await supabase
    .from('user_roles')
    .select('role, department_id')
    .eq('user_id', user.id);

  if (roleError || !userRoles || !userRoles.length) {
    return redirect('/?message=You do not have permission to access this page');
  }

  const isManager = userRoles.some(ur => ur.role === 'manager');

  if (!isManager) {
    return redirect('/?message=You do not have permission to access this page');
  }

  // Get the manager's department ID
  const managerDepartmentId = userRoles.find(ur => ur.role === 'manager')?.department_id;

  if (!managerDepartmentId) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Team Member Profile</h1>
        <p className="text-amber-500">You are not assigned to any department as a manager.</p>
        <Link href="/mgmt">
          <Button className="mt-4">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  // Get the profile with department info
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select(`
      *,
      departments(name)
    `)
    .eq('id', id)
    .eq('department_id', managerDepartmentId)
    .single();

  // Get the user's role
  if (profile) {
    const { data: userRoleData, error: userRoleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', id)
      .single();

    if (userRoleData) {
      profile.role = userRoleData.role;
    }
  }

  if (profileError || !profile) {
    console.error('Error fetching profile:', profileError);
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Team Member Profile</h1>
        <p className="text-red-500">Error loading profile. The user may not exist, may not be in your department, or you don't have permission to view it.</p>
        <Link href="/mgmt">
          <Button className="mt-4">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <Link href="/mgmt" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back to Dashboard
        </Link>
      </div>

      <ManagerProfileEditForm profile={profile} />
    </div>
  );
}
