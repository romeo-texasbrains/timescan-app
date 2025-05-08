'use client'; // Directive must be at the very top

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Topbar from '@/components/Topbar'; // Import Topbar here

// Simple check for mobile width
const isMobileWidth = () => typeof window !== 'undefined' && window.innerWidth < 768;

interface MainContentWrapperProps {
  children: React.ReactNode;
  userEmail: string;
  timezone: string;
}

export default function MainContentWrapper({ children, userEmail, timezone }: MainContentWrapperProps) {
  const pathname = usePathname();
  // State to track sidebar collapse status and visibility
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(isMobileWidth());
  const [isSidebarHidden, setIsSidebarHidden] = useState(isMobileWidth());
  const [isMobile, setIsMobile] = useState(isMobileWidth());

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
    }
  }, [pathname]);

  return (
    <>
      {/* Topbar is now outside the main content wrapper */}
      <Topbar userEmail={userEmail} timezone={timezone} isSidebarCollapsed={isSidebarCollapsed} />

      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out overflow-x-hidden pt-14 ${
          isMobile ? 'ml-0' : (isSidebarCollapsed ? 'ml-20' : 'ml-64')
        }`}
      >
        <main className="flex-1 p-3 xs:p-4 sm:p-6 md:p-8 lg:p-10 mobile-spacing">
          {/* Children will inherit the TimezoneContext provided in layout.tsx */}
          {children}
        </main>
      </div>
    </>
  )
}