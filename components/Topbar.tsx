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

export default function Topbar({ userEmail, timezone, isSidebarCollapsed: initialCollapsed = false }: TopbarProps & { isSidebarCollapsed?: boolean }) {
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
    // We want to show the sidebar when it's hidden, and hide it when it's visible
    const newState = !isSidebarHidden;

    console.log('Toggling sidebar:', { newState, currentState: isSidebarHidden });

    // Set local state first to prevent flickering
    setIsSidebarHidden(!newState);

    // Dispatch event to toggle sidebar
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('toggleSidebar', {
        detail: { isOpen: newState }
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
