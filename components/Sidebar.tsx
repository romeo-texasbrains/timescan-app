"use client";
import { useState, useEffect, useTransition } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { HomeIcon, QrCodeIcon, ClockIcon, UsersIcon, Cog6ToothIcon, ChartBarIcon, DocumentTextIcon, ArrowLeftOnRectangleIcon, ChevronDoubleLeftIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import { logoutAction } from '@/app/actions/authActions';
import { toast } from 'sonner';

// Define valid roles
type UserRole = 'user' | 'manager' | 'admin';

// Sidebar links based on role
const sections: Record<UserRole, { label: string, href: string, icon: React.ElementType }[]> = {
  user: [
    { label: 'Dashboard', href: '/', icon: HomeIcon },
    { label: 'Scan', href: '/scan', icon: QrCodeIcon },
    { label: 'History', href: '/history', icon: ClockIcon },
  ],
  manager: [
    { label: 'Dashboard', href: '/', icon: HomeIcon },
    { label: 'Scan', href: '/scan', icon: QrCodeIcon },
    { label: 'History', href: '/history', icon: ClockIcon },
    { label: 'Reports', href: '/mgmt/reports', icon: ChartBarIcon },
    { label: 'Adjustments', href: '/mgmt/adjustments', icon: DocumentTextIcon },
  ],
  admin: [
    { label: 'Dashboard', href: '/admin', icon: HomeIcon },
    { label: 'Scan', href: '/scan', icon: QrCodeIcon },
    { label: 'History', href: '/history', icon: ClockIcon },
    { label: 'Employees', href: '/admin/employees', icon: UsersIcon },
    { label: 'Reports', href: '/admin/reports', icon: ChartBarIcon },
    { label: 'Settings', href: '/admin/settings', icon: Cog6ToothIcon },
  ],
};

// Animation variants for sidebar width
const sidebarVariants = {
  open: { width: '16rem' },
  collapsed: { width: '5rem' }
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
  const [isCollapsed, setIsCollapsed] = useState(isMobileWidth());
  const [isLoggingOut, startLogoutTransition] = useTransition();

  useEffect(() => {
    const checkWidth = () => {
      const mobile = isMobileWidth();
      setIsCollapsed(current => (mobile ? true : current)); 
    };
    window.addEventListener('resize', checkWidth);
    checkWidth();
    return () => window.removeEventListener('resize', checkWidth);
  }, []);

  const handleLogoutClick = () => {
    startLogoutTransition(async () => {
      try {
        await logoutAction();
        toast.info("Logging out...");
      } catch (error) {
        console.error("Logout failed:", error);
        toast.error("Logout failed. Please try again.");
      }
    });
  };

  return (
    <motion.aside
      variants={sidebarVariants}
      initial={false}
      animate={isCollapsed ? 'collapsed' : 'open'}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={clsx(
        "fixed top-0 left-0 h-screen flex flex-col shadow-xl z-30",
        "bg-sidebar/80 dark:bg-sidebar/80 backdrop-blur-lg border-r border-white/10 text-sidebar-foreground"
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
        {/* Collapse button removed from here */}
      </div>

       {/* Collapse Toggle Button Section - Moved below header */}
        <div className={clsx("px-2", isCollapsed && "px-0 flex justify-center")}>
           <motion.button
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            className={clsx(
                "flex items-center justify-center p-2 rounded-lg w-full",
                "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors",
                 !isCollapsed && "ml-auto w-auto" // Align right only when expanded
            )}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
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
            title={isCollapsed ? label : undefined}
            className={clsx(
              'flex items-center gap-3 py-2.5 rounded-lg transition-all duration-200 ease-in-out',
              'text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
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
            "flex items-center gap-2 w-full py-2.5 rounded-lg transition-all duration-200 ease-in-out font-medium",
            "bg-sidebar-accent/80 hover:bg-sidebar-accent text-sidebar-accent-foreground",
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
  );
}
