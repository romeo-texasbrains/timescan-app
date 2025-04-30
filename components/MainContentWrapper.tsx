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
        {/* Pass timezone prop to Topbar */}
        <Topbar userEmail={userEmail} timezone={timezone} />
        <main className="flex-1 p-4 sm:p-6 md:p-8 lg:p-10">
          {/* Children will inherit the TimezoneContext provided in layout.tsx */}
          {children}
        </main>
      </div>
  )
} 