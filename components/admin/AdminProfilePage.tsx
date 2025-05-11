'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/lib/types/profile';
import { redirect, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import AdminProfileEditForm from '@/components/admin/AdminProfileEditForm';

interface AdminProfilePageProps {
  id: string;
}

export default function AdminProfilePage({ id }: AdminProfilePageProps) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // Check if user is admin
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
          router.push('/login?message=Please log in to access this page');
          return;
        }

        // Get user role
        const { data: userRoles, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (roleError || !userRoles || !userRoles.length) {
          router.push('/?message=You do not have permission to access this page');
          return;
        }

        const isAdmin = userRoles.some(ur => ur.role === 'admin');

        if (!isAdmin) {
          router.push('/?message=You do not have permission to access this page');
          return;
        }

        // Get the profile with department info
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select(`
            *,
            departments(name)
          `)
          .eq('id', id)
          .single();

        // Get all departments for the dropdown
        const { data: departmentsData, error: departmentsError } = await supabase
          .from('departments')
          .select('id, name')
          .order('name');

        // Get the user's role
        const { data: userRoleData, error: userRoleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', id)
          .single();

        if (userRoleData && profileData) {
          profileData.role = userRoleData.role;
        }

        if (profileError || !profileData) {
          setError('Error loading profile. The user may not exist or you don\'t have permission to view it.');
        } else {
          setProfile(profileData);
        }

        if (departmentsData) {
          setDepartments(departmentsData);
        }
      } catch (err) {
        console.error('Error loading profile data:', err);
        setError('An unexpected error occurred while loading the profile.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id, router, supabase]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">Employee Profile</h1>
        <p className="text-red-500">{error || 'Profile not found'}</p>
        <Link href="/admin/employees">
          <Button className="mt-4">Back to Employees</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <Link href="/admin/employees" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back to Employees
        </Link>
      </div>
      
      <AdminProfileEditForm 
        profile={profile} 
        departments={departments} 
      />
    </div>
  );
}
