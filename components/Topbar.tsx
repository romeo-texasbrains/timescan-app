"use client";
import { BellIcon, UserCircleIcon, Bars3Icon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import TimeDisplay from './TimeDisplay';
import { useState, useEffect } from 'react';
import clsx from 'clsx';

interface TopbarProps {
  userEmail: string;
  timezone: string;
}

// Create a client-only wrapper component to handle hydration mismatches
import dynamic from 'next/dynamic';

// Server component that doesn't depend on window
function TopbarServer({ userEmail, timezone, isSidebarCollapsed = false }: TopbarProps & { isSidebarCollapsed?: boolean }) {
  // Use a fixed layout for server rendering to avoid hydration mismatches
  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 100, delay: 0.2 }}
      className="flex items-center justify-between bg-card/80 dark:bg-card/80 backdrop-blur-lg border-b border-white/10 shadow px-2 sm:px-6 py-2 fixed top-0 z-20 h-14 transition-all duration-300 ease-in-out left-0 right-0 w-full"
    >
      {/* Left side: Logo only for server rendering */}
      <div className="flex items-center gap-2">
        <Link href="/" className="relative flex items-center h-7 w-14 sm:h-8 sm:w-16">
          <Image
            src="/logo.png"
            alt="TimeScan Logo"
            width={64}
            height={32}
            style={{ width: '100%', height: '100%' }}
            className="object-contain"
          />
        </Link>
      </div>

      {/* Right side: Time Display, Notifications and User */}
      <div className="flex items-center gap-2 sm:gap-6">
        {/* Time Display - Placed before notifications/user */}
        <TimeDisplay timezone={timezone} />

        {/* User Info */}
        <div className="flex items-center gap-1 sm:gap-2">
          <UserCircleIcon className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
          <span className="hidden sm:inline font-medium text-sm text-foreground truncate max-w-[150px]">{userEmail}</span>
        </div>
      </div>
    </motion.header>
  );
}

// Client-only component that handles all the dynamic behavior
function TopbarClient({ userEmail, timezone, isSidebarCollapsed: initialCollapsed = false }: TopbarProps & { isSidebarCollapsed?: boolean }) {
  // Track sidebar state locally
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(initialCollapsed);
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Simple check for mobile width
  const checkIfMobile = () => {
    if (typeof window !== 'undefined') {
      setIsMobile(window.innerWidth < 768);
    }
  };

  // Initialize mobile state
  useEffect(() => {
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Listen for sidebar state changes
  useEffect(() => {
    const handleSidebarStateChange = (event: CustomEvent<{ isCollapsed: boolean, isHidden?: boolean }>) => {
      setIsSidebarCollapsed(event.detail.isCollapsed);
      if (event.detail.isHidden !== undefined) {
        setIsSidebarHidden(event.detail.isHidden);
      }
    };

    // Add event listener
    window.addEventListener('sidebarStateChange', handleSidebarStateChange as EventListener);

    // Initialize with prop value
    setIsSidebarCollapsed(initialCollapsed);

    // Clean up
    return () => {
      window.removeEventListener('sidebarStateChange', handleSidebarStateChange as EventListener);
    };
  }, [initialCollapsed]);

  // Toggle sidebar visibility on mobile
  const toggleSidebar = () => {
    // If the sidebar is hidden (isSidebarHidden is true), we want to show it (isOpen: true)
    // If the sidebar is visible (isSidebarHidden is false), we want to hide it (isOpen: false)
    const shouldOpen = isSidebarHidden;

    console.log('Toggling sidebar:', { shouldOpen, currentlyHidden: isSidebarHidden });

    // Set local state first to prevent flickering
    setIsSidebarHidden(!shouldOpen);

    // Dispatch event to toggle sidebar
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('toggleSidebar', {
        detail: { isOpen: shouldOpen }
      });
      window.dispatchEvent(event);
    }
  };
  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 100, delay: 0.2 }}
      className={clsx(
        "flex items-center justify-between bg-card/80 dark:bg-card/80 backdrop-blur-lg border-b border-white/10 shadow px-2 sm:px-6 py-2 fixed top-0 z-20 h-14 transition-all duration-300 ease-in-out",
        isMobile ? 'left-0 right-0 w-full' : (isSidebarCollapsed ? 'left-20 right-0 w-[calc(100%-5rem)]' : 'left-64 right-0 w-[calc(100%-16rem)]')
      )}
    >
      {/* Left side: Hamburger menu on mobile, Logo */}
      <div className="flex items-center gap-2">
        {isMobile && (
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary active:bg-primary/20 transition-colors"
            aria-label="Toggle sidebar"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
        )}

        <Link href="/" className="relative flex items-center h-7 w-14 sm:h-8 sm:w-16">
          <Image
            src="/logo.png"
            alt="TimeScan Logo"
            width={64}
            height={32}
            style={{ width: '100%', height: '100%' }}
            className="object-contain"
          />
        </Link>
      </div>

      {/* Right side: Time Display, Notifications and User */}
      <div className="flex items-center gap-2 sm:gap-6">
        {/* Time Display - Placed before notifications/user */}
        <TimeDisplay timezone={timezone} />

        {/* Notification Icon - Hidden on smallest screens */}
        <button className="hidden xs:inline-flex relative p-1 rounded-full text-muted-foreground hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary touch-manipulation" aria-label="Notifications" disabled>
          <BellIcon className="h-5 w-5 sm:h-6 sm:w-6" />
        </button>

        {/* User Info */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Update icon/text colors */}
          <UserCircleIcon className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
          <span className="hidden sm:inline font-medium text-sm text-foreground truncate max-w-[150px]">{userEmail}</span>
        </div>
      </div>
    </motion.header>
  );
}

// Create a client-only version of the Topbar component
const ClientOnlyTopbar = dynamic(() => Promise.resolve(TopbarClient), {
  ssr: false,
});

// Export the client-only version as the default component
export default function Topbar(props: TopbarProps & { isSidebarCollapsed?: boolean }) {
  // Use the server component for SSR, which will be replaced by the client component on hydration
  return <ClientOnlyTopbar {...props} />;
}
