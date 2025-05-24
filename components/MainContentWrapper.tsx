'use client'; // Directive must be at the very top

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Topbar from '@/components/Topbar'; // Import Topbar here
import BottomNavigation from '@/components/BottomNavigation'; // Import BottomNavigation
import clsx from 'clsx'; // Import clsx for className conditionals
import { useTimezone } from '@/context/TimezoneContext'; // Import useTimezone hook

// Simple check for mobile width
const isMobileWidth = () => typeof window !== 'undefined' && window.innerWidth < 768;

// Define valid roles
type UserRole = 'user' | 'manager' | 'admin';

interface MainContentWrapperProps {
  children: React.ReactNode;
  userEmail: string;
  timezone: string;
  role?: UserRole;
}

import dynamic from 'next/dynamic';

// Server component with fixed layout to avoid hydration mismatches
function MainContentWrapperServer({ children, userEmail, timezone, role = 'user' }: MainContentWrapperProps) {
  return (
    <>
      {/* Topbar is now outside the main content wrapper */}
      <Topbar userEmail={userEmail} timezone={timezone} isSidebarCollapsed={true} />

      <div className="flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out overflow-x-hidden pt-14 ml-0">
        <main className="flex-1 p-3 xs:p-4 sm:p-6 md:p-8 lg:p-10 mobile-spacing pb-24">
          {/* Children will inherit the TimezoneContext provided in layout.tsx */}
          {children}
        </main>
      </div>

      {/* Bottom Navigation for mobile */}
      <BottomNavigation role={role} />
    </>
  );
}

// Client component with dynamic layout
function MainContentWrapperClient({ children, userEmail, timezone: propTimezone, role = 'user' }: MainContentWrapperProps) {
  const pathname = usePathname();
  // State to track sidebar collapse status and visibility
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(isMobileWidth());
  const [isSidebarHidden, setIsSidebarHidden] = useState(isMobileWidth());
  const [isMobile, setIsMobile] = useState(isMobileWidth());
  const [showSidebar, setShowSidebar] = useState(false);

  // Get timezone from context
  const { timezone: contextTimezone } = useTimezone();

  useEffect(() => {
    // Listener to sync sidebar collapse state for padding adjustment
    const handleResize = () => {
      const mobile = isMobileWidth();
      setIsMobile(mobile);
      setIsSidebarCollapsed(mobile);
      setIsSidebarHidden(mobile);
    };

    // Listen for sidebar state changes from Sidebar component
    const handleSidebarStateChange = (event: CustomEvent<{ isCollapsed: boolean, isHidden?: boolean }>) => {
      setIsSidebarCollapsed(event.detail.isCollapsed);
      if (event.detail.isHidden !== undefined) {
        setIsSidebarHidden(event.detail.isHidden);
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('sidebarStateChange', handleSidebarStateChange as EventListener);

    handleResize(); // Initial check

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('sidebarStateChange', handleSidebarStateChange as EventListener);
    };
  }, []);

  // Update collapse state on route change if needed (optional)
  useEffect(() => {
    if (isMobileWidth()) {
      setIsSidebarCollapsed(true);
      setIsSidebarHidden(true);
      setShowSidebar(false);
    }
  }, [pathname]);

  // Note: Timezone refresh is now handled by TimezoneContext
  // No need to refresh timezone here as it's managed centrally

  // Handle "More" button click from bottom navigation
  // This is now a fallback in case the BottomNavigation component's own more menu fails
  const handleMoreClick = () => {
    // We'll leave this empty for now as we're using the BottomNavigation's own more menu
    // If needed, we can implement a fallback behavior here
    console.log("More button clicked in MainContentWrapper");
  };

  return (
    <>
      {/* Topbar is now outside the main content wrapper */}
      <Topbar userEmail={userEmail} timezone={contextTimezone || propTimezone} isSidebarCollapsed={isSidebarCollapsed} />

      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out overflow-x-hidden pt-14 ${
          isMobile ? 'ml-0' : (isSidebarCollapsed ? 'ml-20' : 'ml-64')
        }`}
      >
        <main className={clsx(
          "flex-1 p-3 xs:p-4 sm:p-6 md:p-8 lg:p-10 mobile-spacing",
          isMobile ? "pb-24" : "pb-10" // More padding on mobile for bottom navigation
        )}>
          {/* Children will inherit the TimezoneContext provided in layout.tsx */}
          {children}
        </main>
      </div>

      {/* Bottom Navigation for mobile */}
      {isMobile && <BottomNavigation role={role} onMoreClick={handleMoreClick} />}
    </>
  );
}

// Create a client-only version of the MainContentWrapper component
const ClientOnlyMainContentWrapper = dynamic(() => Promise.resolve(MainContentWrapperClient), {
  ssr: false,
  loading: () => <MainContentWrapperServer userEmail="" timezone="" role="user" children={null} />
});

// Export the client-only version as the default component
export default function MainContentWrapper(props: MainContentWrapperProps) {
  // Use the client-only component to avoid hydration mismatches
  return <ClientOnlyMainContentWrapper {...props} />;
}