"use client";
import { useState, useEffect, useTransition } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { HomeIcon, QrCodeIcon, ClockIcon, UsersIcon, Cog6ToothIcon, ChartBarIcon, DocumentTextIcon, ArrowLeftOnRectangleIcon, ChevronDoubleLeftIcon, BuildingOfficeIcon, UserIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { logoutAction } from '@/app/actions/authActions';
import { clientLogout } from '@/lib/auth/clientLogout';
import { toast } from 'sonner';

// Define valid roles
type UserRole = 'user' | 'manager' | 'admin';

// Sidebar links based on role
const sections: Record<UserRole, { label: string, href: string, icon: React.ElementType }[]> = {
  user: [
    { label: 'Dashboard', href: '/', icon: HomeIcon },
    { label: 'Scan', href: '/scan', icon: QrCodeIcon },
    { label: 'History', href: '/history', icon: ClockIcon },
    { label: 'Profile', href: '/profile', icon: UserIcon },
  ],
  manager: [
    { label: 'Dashboard', href: '/', icon: HomeIcon },
    { label: 'Scan', href: '/scan', icon: QrCodeIcon },
    { label: 'History', href: '/history', icon: ClockIcon },
    { label: 'Profile', href: '/profile', icon: UserIcon },
    { label: 'Manager', href: '/mgmt', icon: UsersIcon },
    { label: 'Reports', href: '/mgmt/reports', icon: ChartBarIcon },
  ],
  admin: [
    { label: 'Dashboard', href: '/admin/dashboard', icon: HomeIcon },
    { label: 'Admin', href: '/admin', icon: ChartBarIcon },
    { label: 'Scan', href: '/scan', icon: QrCodeIcon },
    { label: 'History', href: '/history', icon: ClockIcon },
    { label: 'Profile', href: '/profile', icon: UserIcon },
    { label: 'Employees', href: '/admin/employees', icon: UsersIcon },
    { label: 'Departments', href: '/admin/departments', icon: BuildingOfficeIcon },
    { label: 'Adherence', href: '/admin/adherence', icon: ClockIcon },
    { label: 'Reports', href: '/admin/reports', icon: ChartBarIcon },
    { label: 'Settings', href: '/admin/settings', icon: Cog6ToothIcon },
  ],
};

// Animation variants for sidebar width
const sidebarVariants = {
  open: { width: '16rem', x: 0 },
  collapsed: { width: '5rem', x: 0 },
  hidden: { width: '16rem', x: '-100%' }
};

// Animation variants for text visibility
const textVariants = {
  open: { opacity: 1, x: 0, transition: { delay: 0.1 } },
  collapsed: { opacity: 0, x: -10 }
};

// Simple check for mobile width (e.g., < 768px)
const isMobileWidth = () => typeof window !== 'undefined' && window.innerWidth < 768;

export default function Sidebar({ role = 'user' }: { role?: UserRole }) {
  const pathname = usePathname();
  const links = sections[role] || sections.user;
  // Start with true for server rendering to avoid hydration mismatch
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [isLoggingOut, startLogoutTransition] = useTransition();

  // Track if sidebar was manually toggled
  const [wasManuallyToggled, setWasManuallyToggled] = useState(false);

  useEffect(() => {
    const checkWidth = () => {
      const mobile = isMobileWidth();
      setIsMobile(mobile);

      // Only auto-hide if not manually toggled
      if (!wasManuallyToggled) {
        // On mobile, we want to hide the sidebar completely when collapsed
        if (mobile && isCollapsed) {
          setIsHidden(true);
        } else {
          setIsHidden(false);
        }

        // Keep sidebar collapsed on mobile
        setIsCollapsed(current => (mobile ? true : current));
      }
    };

    window.addEventListener('resize', checkWidth);
    checkWidth();
    return () => window.removeEventListener('resize', checkWidth);
  }, [isCollapsed, wasManuallyToggled]);

  // Listen for sidebar toggle events from the hamburger menu
  useEffect(() => {
    const handleSidebarToggleEvent = (event: CustomEvent<{ isOpen: boolean }>) => {
      if (isMobile) {
        console.log('Sidebar received toggle event:', event.detail);

        // Mark as manually toggled to prevent auto-collapse
        setWasManuallyToggled(true);

        // If isOpen is true, we want to show the sidebar
        if (event.detail.isOpen) {
          setIsHidden(false);
          setIsCollapsed(false);
        } else {
          // If isOpen is false, we want to hide the sidebar
          setIsHidden(true);
          setIsCollapsed(true);
        }
      }
    };

    window.addEventListener('toggleSidebar', handleSidebarToggleEvent as EventListener);
    return () => {
      window.removeEventListener('toggleSidebar', handleSidebarToggleEvent as EventListener);
    };
  }, [isMobile]);

  // Update state on route change
  useEffect(() => {
    if (isMobile) {
      // On mobile, hide the sidebar when navigating to a new page
      setIsHidden(true);
      setIsCollapsed(true);
      // Reset manual toggle flag
      setWasManuallyToggled(false);

      // Dispatch event to update other components
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('sidebarStateChange', {
          detail: { isCollapsed: true, isHidden: true }
        });
        window.dispatchEvent(event);
      }
    }
  }, [pathname, isMobile]);

  // Handle sidebar collapse toggle and dispatch custom event
  const handleSidebarToggle = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);

    // Mark as manually toggled
    setWasManuallyToggled(true);

    // On mobile, hide the sidebar when collapsed
    if (isMobile && newState) {
      setIsHidden(true);
    } else {
      setIsHidden(false);
    }

    // Dispatch custom event for other components to listen to
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('sidebarStateChange', {
        detail: { isCollapsed: newState, isHidden: isMobile && newState }
      });
      window.dispatchEvent(event);
    }
  };

  // Close sidebar when clicking a link on mobile
  const handleLinkClick = () => {
    if (isMobile) {
      setIsHidden(true);
      setIsCollapsed(true);
      // Reset manual toggle flag
      setWasManuallyToggled(false);

      // Dispatch event to update other components
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('sidebarStateChange', {
          detail: { isCollapsed: true, isHidden: true }
        });
        window.dispatchEvent(event);
      }
    }
  };

  const handleLogoutClick = () => {
    startLogoutTransition(async () => {
      try {
        // Try server-side logout first
        await logoutAction();
        toast.info("Logging out...");
      } catch (error) {
        console.error("Server-side logout failed:", error);

        // Try client-side logout as fallback
        toast.info("Trying client-side logout...");

        try {
          // Attempt client-side logout
          const result = await clientLogout();

          if (result.success) {
            toast.success("Logged out successfully");
          } else {
            toast.error("Logout failed");
          }

          // Redirect to login page regardless of client-side logout result
          setTimeout(() => {
            window.location.href = '/login?message=Session+expired';
          }, 1000);
        } catch (clientError) {
          console.error("Client-side logout failed:", clientError);

          // Last resort: just redirect to login
          toast.info("Redirecting to login page...");
          setTimeout(() => {
            window.location.href = '/login?message=Session+expired';
          }, 1000);
        }
      }
    });
  };

  return (
    <>
      {/* Overlay for mobile when sidebar is open */}
      {isMobile && !isHidden && !isCollapsed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleLinkClick} // Close sidebar when clicking overlay
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30"
        />
      )}

      <motion.aside
        variants={sidebarVariants}
        initial={false}
        animate={isHidden ? 'hidden' : (isCollapsed ? 'collapsed' : 'open')}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={clsx(
          "fixed top-0 left-0 h-screen flex flex-col shadow-xl z-40",
          "bg-sidebar/80 dark:bg-sidebar/80 backdrop-blur-lg border-r border-white/10 text-sidebar-foreground",
          "touch-manipulation", // Improve touch handling
          isMobile && !isHidden && "w-[16rem]", // Force width on mobile when visible
          isMobile && "md:flex hidden" // Hide on mobile, show on desktop
        )}
      >
       {/* Header Section - Logo and Title */}
       <div className={clsx(
          "flex items-center gap-3 px-6 py-5 font-bold text-xl tracking-wide text-foreground overflow-hidden",
          isCollapsed && "px-0 justify-center py-4"
      )}>
         <Link href="/" className={clsx("relative flex-shrink-0", isCollapsed ? "h-8 w-8" : "h-7 w-7")}>
            <Image
              src="/logo.png"
              alt="Logo"
              width={200}
              height={200}
              priority
              style={{ width: '100%', height: '100%' }}
              className="object-contain"
            />
         </Link>
         <AnimatePresence>
          {!isCollapsed && (
            <motion.span
              variants={textVariants}
              initial="collapsed"
              animate="open"
              exit="collapsed"
              className="whitespace-nowrap mr-auto"
            >
              TimeScan
            </motion.span>
          )}
        </AnimatePresence>
      </div>

       {/* Collapse Toggle Button Section - Moved below header */}
        <div className={clsx("px-2", isCollapsed && "px-0 flex justify-center")}>
           <motion.button
            onClick={handleSidebarToggle}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            className={clsx(
                "flex items-center justify-center p-2 rounded-lg w-full",
                "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors",
                "active:bg-sidebar-accent active:text-sidebar-accent-foreground", // Better touch feedback
                !isCollapsed && "ml-auto w-auto" // Align right only when expanded
            )}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
                animate={{ rotate: isCollapsed ? 180 : 0 }}
                transition={{ duration: 0.3 }}
            >
               <ChevronDoubleLeftIcon className="h-5 w-5" />
            </motion.div>
          </motion.button>
        </div>

       {/* Navigation Links - Add padding top */}
       <nav className="flex-1 px-2 pt-4 pb-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {links.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={handleLinkClick}
            title={isCollapsed ? label : undefined}
            className={clsx(
              'flex items-center gap-3 py-3 rounded-lg transition-all duration-200 ease-in-out',
              'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              'active:bg-sidebar-accent/80 active:text-sidebar-accent-foreground', // Better touch feedback
              pathname === href && 'bg-sidebar-primary text-sidebar-primary-foreground font-semibold shadow-md',
              isCollapsed ? 'px-6 justify-center hover:scale-105' : 'px-4 hover:translate-x-1'
            )}
          >
            <Icon className={clsx("h-5 w-5 flex-shrink-0")} />
            <AnimatePresence>
              {!isCollapsed && (
                 <motion.span
                  variants={textVariants}
                  initial="collapsed"
                  animate="open"
                  exit="collapsed"
                  className="whitespace-nowrap"
                >
                  {label}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        ))}
      </nav>

      {/* Footer Section - Logout */}
      <div className={clsx("mt-auto border-t border-white/10", isCollapsed ? "px-0 py-3" : "px-4 py-4")}>
        <button
          onClick={handleLogoutClick}
          title={isCollapsed ? "Logout" : undefined}
          disabled={isLoggingOut}
          className={clsx(
            "flex items-center gap-2 w-full py-3 rounded-lg transition-all duration-200 ease-in-out font-medium",
            "bg-sidebar-accent/80 hover:bg-sidebar-accent text-sidebar-accent-foreground",
            "active:bg-sidebar-accent/90 active:scale-95", // Better touch feedback
            isCollapsed ? 'px-6 justify-center hover:scale-105' : 'px-4 hover:translate-x-1',
            isLoggingOut && 'opacity-50 cursor-not-allowed'
          )}
        >
          <ArrowLeftOnRectangleIcon className={clsx("h-5 w-5 flex-shrink-0", isLoggingOut && 'animate-pulse')} />
           <AnimatePresence>
            {!isCollapsed && (
               <motion.span
                variants={textVariants}
                initial="collapsed"
                animate="open"
                exit="collapsed"
                className="whitespace-nowrap"
               >
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
    </>
  );
}
