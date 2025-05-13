import { createClient } from '@/lib/supabase/server' // USE SERVER CLIENT FOR LAYOUT
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { cookies } from 'next/headers'
import { Database } from '@/lib/supabase/database.types'
import { Toaster } from 'sonner' // Correct import path for sonner
import { TimezoneProvider } from '@/context/TimezoneContext' // Import the Provider
import MainContentWrapper from '@/components/MainContentWrapper' // Import the new component
import LoadingProvider from '@/context/LoadingContext' // Import the Loading Provider
import ClientErrorHandler from '@/components/ClientErrorHandler' // Import the client error handler wrapper
import BirthdayProvider from '@/components/birthday/BirthdayProvider' // Import the birthday provider
import dynamic from 'next/dynamic'

// Dynamically import client-only components with no SSR
const InstallPrompt = dynamic(() => import('@/components/InstallPrompt'), { ssr: false })
const NetworkStatus = dynamic(() => import('@/components/NetworkStatus'), { ssr: false })
const UpdateNotification = dynamic(() => import('@/components/UpdateNotification'), { ssr: false })

// Define role type here as well
type UserRole = 'user' | 'manager' | 'admin';

type AppSettings = Database['public']['Tables']['app_settings']['Row']

// Server component to fetch data
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies()
  const supabase = await createClient() // Use server-side Supabase

  // Get the user session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  // Check if session is valid
  if (!session || sessionError) {
    console.log('Redirecting to login from layout - invalid session');
    return redirect('/login?message=Please log in.');
  }

  // Get the user data
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  // If there's an error getting the user or no user, redirect to login
  if (userError || !user) {
    console.error('Error getting user in layout:', userError);
    return redirect('/login?message=Authentication error. Please log in again.');
  }

  let profile = null;
  let profileError = null;

  if (user && user.id) {
    const profileResponse = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    profile = profileResponse.data;
    profileError = profileResponse.error;
  }

  if (profileError) {
    console.error('Error fetching profile in layout:', profileError);
    // Handle error appropriately - maybe redirect or show error page
    // For now, default to 'user' role but log the issue
  }

  const userRole = (profile?.role as UserRole) || 'user';
  const userEmail = user?.email || 'User';

  // --- Fetch Timezone Setting ---
  let timezone = 'UTC'; // Default string value
  try {
    // Explicitly select timezone as text
    const { data: settings, error: tzError } = await supabase
      .from('app_settings')
      .select('timezone') // Select the column
      .eq('id', 1)
      .single(); // Get the single row object

    if (tzError) {
      if (tzError.code !== 'PGRST116') { // Ignore row not found
        console.error("Error fetching timezone setting in layout:", tzError);
      }
    } else {
      // Check if data and timezone property exist and are string
      if (settings?.timezone && typeof settings.timezone === 'string') {
        timezone = settings.timezone;
      }
    }
  } catch (error) {
    console.error("Error fetching timezone setting in layout:", error);
    // Keep default timezone if fetch fails
  }
  // -----------------------------

  // Client-side logout remains the same, but needs to be passed down
  // Or handled differently, maybe via a server action in Sidebar

  return (
    <LoadingProvider>
      <div className="min-h-screen bg-background flex">
        {/* Network status indicator */}
        <NetworkStatus />

        {/* Update notification */}
        <UpdateNotification />

        {/* Client-side error handler to catch unhandled errors */}
        <ClientErrorHandler />

        {/* Sidebar now needs user info passed as props */}
        <Sidebar
          role={userRole}
        />

        {/* Wrap MainContentWrapper with TimezoneProvider */}
        <TimezoneProvider initialTimezone={timezone}>
          <MainContentWrapper userEmail={userEmail} timezone={timezone} role={userRole}>
            {/* Birthday notifications */}
            <BirthdayProvider />

            {/* PWA Install Prompt */}
            <InstallPrompt />

            <div className="mobile-spacing">
              {children}
            </div>
          </MainContentWrapper>
        </TimezoneProvider>
        <Toaster position="top-center" /> {/* Add Toaster here for sonner notifications */}
      </div>
    </LoadingProvider>
  );
}

// --- Client Component Wrapper for Main Content (REMOVED FROM HERE) ---
// All the code previously here ( MainContentWrapper function, imports for useState/useEffect/usePathname, isMobileWidth) has been moved to components/MainContentWrapper.tsx
