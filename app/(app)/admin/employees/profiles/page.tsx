import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Profile } from '@/lib/types/profile';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials, formatDate } from '@/lib/types/profile';
import { UserIcon, BuildingOfficeIcon, PhoneIcon, EnvelopeIcon } from '@heroicons/react/24/outline';

export default async function AdminEmployeeProfilesPage() {
  const supabase = await createClient();

  // Check if user is admin
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  
  if (userError || !user) {
    return redirect('/login?message=Please log in to access this page');
  }

  // Get user role
  const { data: userRoles, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id);

  if (roleError || !userRoles || !userRoles.length) {
    return redirect('/?message=You do not have permission to access this page');
  }

  const isAdmin = userRoles.some(ur => ur.role === 'admin');
  
  if (!isAdmin) {
    return redirect('/?message=You do not have permission to access this page');
  }

  // Get all profiles with department info
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select(`
      *,
      departments(name)
    `)
    .order('full_name');

  if (profilesError) {
    console.error('Error fetching profiles:', profilesError);
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Employee Profiles</h1>
        <p className="text-red-500">Error loading profiles. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Employee Profiles</h1>
        <Link href="/admin/employees">
          <Button variant="outline">Back to Employees</Button>
        </Link>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {profiles.map((profile: any) => (
          <Link 
            key={profile.id} 
            href={`/admin/employees/profiles/${profile.id}`}
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
