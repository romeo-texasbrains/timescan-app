import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Profile } from '@/lib/types/profile';
import ProfileForm from '@/components/profile/ProfileForm';
import ProfilePictureUpload from '@/components/profile/ProfilePictureUpload';
import HealthCardUpload from '@/components/profile/HealthCardUpload';

export default async function ProfilePage() {
  const supabase = await createClient();

  // Get the current user
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return redirect('/login?message=Please log in to view your profile');
  }

  // Get the user's profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single<Profile>();

  if (profileError) {
    console.error('Error fetching profile:', profileError);
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Profile</h1>
        <p className="text-red-500">Error loading profile. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">My Profile</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column - Profile Picture and Health Card */}
        <div className="space-y-6">
          <ProfilePictureUpload profile={profile} />
          <HealthCardUpload profile={profile} />
        </div>
        
        {/* Right Column - Profile Form */}
        <div className="md:col-span-2">
          <ProfileForm profile={profile} />
        </div>
      </div>
    </div>
  );
}
