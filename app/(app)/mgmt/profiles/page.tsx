import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Profile } from '@/lib/types/profile';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials, formatDate } from '@/lib/types/profile';
import { UserIcon, BuildingOfficeIcon, PhoneIcon, EnvelopeIcon } from '@heroicons/react/24/outline';

export default async function ManagerEmployeeProfilesPage() {
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
        <h1 className="text-2xl font-bold mb-4">Team Profiles</h1>
        <p className="text-amber-500">You are not assigned to any department as a manager.</p>
      </div>
    );
  }

  // Get profiles in the manager's department
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select(`
      *,
      departments(name)
    `)
    .eq('department_id', managerDepartmentId)
    .order('full_name');

  if (profilesError) {
    console.error('Error fetching profiles:', profilesError);
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Team Profiles</h1>
        <p className="text-red-500">Error loading profiles. Please try again later.</p>
      </div>
    );
  }

  // Get department name
  const departmentName = profiles[0]?.departments?.name || 'Your Team';

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Team Profiles: {departmentName}</h1>
        <Link href="/mgmt">
          <Button variant="outline">Back to Dashboard</Button>
        </Link>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {profiles.map((profile: any) => (
          <Link 
            key={profile.id} 
            href={`/mgmt/profiles/${profile.id}`}
            className="block transition-transform hover:scale-[1.02]"
          >
            <Card className="h-full">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12 border-2 border-primary/20">
                    {profile.profile_picture_url ? (
                      <AvatarImage src={profile.profile_picture_url} alt={profile.full_name || ''} />
                    ) : (
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {profile.full_name ? getInitials(profile.full_name) : <UserIcon className="h-6 w-6" />}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">{profile.full_name || 'Unnamed User'}</CardTitle>
                    <CardDescription>
                      {profile.departments?.name || 'No Department'}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {profile.email && (
                    <div className="flex items-center gap-2">
                      <EnvelopeIcon className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{profile.email}</span>
                    </div>
                  )}
                  {profile.phone_number && (
                    <div className="flex items-center gap-2">
                      <PhoneIcon className="h-4 w-4 text-muted-foreground" />
                      <span>{profile.phone_number}</span>
                    </div>
                  )}
                  {profile.date_of_birth && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Birthday:</span>
                      <span>{formatDate(profile.date_of_birth)}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
