import { createClient } from '@/lib/supabase/server' // USE SERVER CLIENT FOR LAYOUT
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Topbar from '@/components/Topbar'
import { cookies } from 'next/headers'
import { Database } from '@/lib/supabase/database.types'
import { Toaster } from 'sonner' // Correct import path for sonner
import { TimezoneProvider } from '@/context/TimezoneContext' // Import the Provider

// Define role type here as well
type UserRole = 'user' | 'manager' | 'admin';

type AppSettings = Database['public']['Tables']['app_settings']['Row']

// Server component to fetch data
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies()
  const supabase = await createClient() // Use server-side Supabase

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.log('Redirecting to login from layout');
    return redirect('/login?message=Please log in.');
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('Error fetching profile in layout:', profileError);
    // Handle error appropriately - maybe redirect or show error page
    // For now, default to 'user' role but log the issue
  }

  const userRole = (profile?.role as UserRole) || 'user';
  const userEmail = user.email || 'User';

  // --- Fetch Timezone Setting ---
  let timezone = 'UTC'; // Default string value
  try {
    // Explicitly select timezone as text
    const { data: settings, error: tzError } = await supabase
      .from('app_settings')
      .select('timezone') // Select the column
      .eq('id', 1)
      .single(); // Get the single row object

    if (tzError && tzError.code !== 'PGRST116') { // Ignore row not found
      throw tzError;
    }
    // Check if data and timezone property exist and are string
    if (settings?.timezone && typeof settings.timezone === 'string') {
      timezone = settings.timezone;
    }
  } catch (error) {
    console.error("Error fetching timezone setting in layout:", error);
    // Keep default timezone if fetch fails
  }
  // -----------------------------

  // Client-side logout remains the same, but needs to be passed down
  // Or handled differently, maybe via a server action in Sidebar

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar now needs user info passed as props */}
      <Sidebar
        role={userRole}
      />

      {/* Wrap MainContentWrapper with TimezoneProvider */}
      <TimezoneProvider initialTimezone={timezone}>
        <MainContentWrapper userEmail={userEmail} timezone={timezone}>
          {children}
        </MainContentWrapper>
      </TimezoneProvider>
      <Toaster /> {/* Add Toaster here for sonner notifications */}
    </div>
  );
}

// --- Client Component Wrapper for Main Content ---
'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

// Simple check for mobile width (copied from Sidebar)
const isMobileWidth = () => typeof window !== 'undefined' && window.innerWidth < 768;

function MainContentWrapper({ children, userEmail, timezone }: {
  children: React.ReactNode,
  userEmail: string,
  timezone: string
}) {
  const pathname = usePathname();
  // State to track sidebar collapse status
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(isMobileWidth());

  useEffect(() => {
    // Listener to sync sidebar collapse state for padding adjustment
    const handleResize = () => {
       setIsSidebarCollapsed(isMobileWidth());
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial check

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update collapse state on route change if needed (optional)
  useEffect(() => {
    setIsSidebarCollapsed(isMobileWidth());
  }, [pathname]);

  return (
     <div
         className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'ml-20' : 'ml-64'} overflow-x-hidden`}
        >
        {/* Topbar can now potentially use useTimezone() hook instead of prop */}
        <Topbar userEmail={userEmail} timezone={timezone} />
        <main className="flex-1 p-4 sm:p-6 md:p-8 lg:p-10">
          {/* Children will inherit the TimezoneContext */}
          {children}
        </main>
      </div>
  )
}
