"use client"; // Needs to be client component to use hooks

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client' // Use client supabase
import { useRouter } from 'next/navigation' // Use navigation hooks
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import toast from 'react-hot-toast';

// Define role type here as well
type UserRole = 'user' | 'manager' | 'admin';

// Simple check for mobile width (copied from Sidebar)
const isMobileWidth = () => typeof window !== 'undefined' && window.innerWidth < 768;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = createClient(); // Use client-side Supabase

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole>('user');
  const [isLoading, setIsLoading] = useState(true);

  // State to track sidebar collapse status (mirrored from Sidebar)
  // We need this here to adjust main content padding
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(isMobileWidth());

  useEffect(() => {
    const getUserData = async () => {
      setIsLoading(true);
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error('Auth error fetching user:', userError);
        router.push('/login');
        return;
      }

      setUserEmail(user.email || 'User');

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        // Keep default role 'user' if profile fetch fails
      } else {
        setUserRole((profile?.role as UserRole) || 'user');
      }
      setIsLoading(false);
    };

    getUserData();

    // Listener to sync sidebar collapse state for padding adjustment
    const handleResize = () => {
       setIsSidebarCollapsed(isMobileWidth());
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check

    return () => window.removeEventListener('resize', handleResize);

  }, [supabase, router]);

  // --- Logout Client Action --- 
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('Logout error:', error);
        toast.error(`Logout failed: ${error.message}`);
    } else {
        router.push('/login'); // Redirect to login after sign out
        router.refresh(); // Optional: ensure state clears
    }
  };
  // ---------------------------

  // Render loading state or placeholder if needed
  if (isLoading) {
    return <div className="min-h-screen bg-background flex items-center justify-center text-foreground">Loading application...</div>; // Or a proper Skeleton UI
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */} 
      <Sidebar 
        role={userRole}
        onLogout={handleLogout} // Pass the client action
      />

      {/* Main content area - Dynamic margin based on sidebar collapse state */}
      <div 
         className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'ml-20' : 'ml-64'} overflow-x-hidden`}
        >
        <Topbar userEmail={userEmail || 'User'} />
        {/* Adjust padding for different screen sizes */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 lg:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
