'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  QrCode,
  Clock,
  Users,
  Settings,
  BarChart,
  FileText,
  Building,
  Menu,
  CheckCircle,
  History,
  Scan,
  LayoutDashboard,
  UserCog
} from 'lucide-react';
import clsx from 'clsx';

// Define valid roles
type UserRole = 'user' | 'manager' | 'admin';

// Navigation links based on role - using Lucide icons
const allLinks: Record<UserRole, { label: string, href: string, icon: React.ElementType, exactPath?: boolean }[]> = {
  user: [
    { label: 'Home', href: '/', icon: Home, exactPath: true },
    { label: 'Scan', href: '/scan', icon: Scan },
    { label: 'History', href: '/history', icon: History },
  ],
  manager: [
    { label: 'Home', href: '/', icon: Home, exactPath: true },
    { label: 'Scan', href: '/scan', icon: Scan },
    { label: 'History', href: '/history', icon: History },
    { label: 'Manager', href: '/mgmt', icon: UserCog, exactPath: true },
    { label: 'Reports', href: '/mgmt/reports', icon: BarChart },
  ],
  admin: [
    { label: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Admin', href: '/admin', icon: BarChart, exactPath: true },
    { label: 'Scan', href: '/scan', icon: Scan },
    { label: 'History', href: '/history', icon: History },
    { label: 'Employees', href: '/admin/employees', icon: Users },
    { label: 'Departments', href: '/admin/departments', icon: Building },
    { label: 'Reports', href: '/admin/reports', icon: BarChart },
    { label: 'Settings', href: '/admin/settings', icon: Settings },
  ],
};

interface BottomNavigationProps {
  role?: UserRole;
  onMoreClick?: () => void;
}

export default function BottomNavigation({ role = 'user', onMoreClick }: BottomNavigationProps) {
  const pathname = usePathname();
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  // Get all links for the role
  const allRoleLinks = allLinks[role] || allLinks.user;

  // Determine which links to show in the main navigation (max 4 + More button = 5 total)
  const mainNavLinks = allRoleLinks.slice(0, 4); // Show first 4 links

  // Determine if we need a "More" button (if we have more than 4 links)
  const hasMoreLinks = allRoleLinks.length > 4;

  // Get the additional links for the "More" menu
  const moreLinks = hasMoreLinks ? allRoleLinks.slice(4) : [];

  // Debug output to help troubleshoot
  useEffect(() => {
    console.log(`Role: ${role}, Total links: ${allRoleLinks.length}, More links: ${moreLinks.length}`);
    if (moreLinks.length > 0) {
      console.log('More links:', moreLinks.map(link => link.label).join(', '));
    }

    // Debug active links
    console.log('Current path:', pathname);
    mainNavLinks.forEach(link => {
      console.log(`Link: ${link.label} (${link.href}) - Active: ${isLinkActive(link.href, link.exactPath)} - ExactPath: ${link.exactPath || false}`);
    });
  }, [role, allRoleLinks.length, moreLinks.length, moreLinks, pathname, mainNavLinks]);

  // Close the more menu when navigating to a new page
  useEffect(() => {
    setIsMoreMenuOpen(false);
  }, [pathname]);

  // Handle More button click
  const handleMoreClick = (e: React.MouseEvent) => {
    // Prevent default behavior
    e.preventDefault();
    e.stopPropagation();

    // Toggle the more menu
    setIsMoreMenuOpen(!isMoreMenuOpen);

    // Log for debugging
    console.log("More button clicked, toggling menu to:", !isMoreMenuOpen);
  };

  // Check if the current path matches a link with more specific matching
  const isLinkActive = (href: string, exactPath?: boolean) => {
    // For exact path matches, only return true if the paths are exactly the same
    if (exactPath) {
      return pathname === href;
    }

    // Special case for admin dashboard
    if (pathname === '/admin/dashboard') {
      // Only the dashboard link should be active on the dashboard page
      return href === '/admin/dashboard';
    }

    // For other admin pages (not dashboard), highlight /admin if it's exactly /admin
    if (pathname.startsWith('/admin/') && pathname !== '/admin/dashboard' && href === '/admin') {
      return true;
    }

    // General case for other paths - don't match parent paths when on a more specific path
    if (href !== '/' && pathname.startsWith(href)) {
      // Don't match dashboard when on other admin pages
      if (pathname.startsWith('/admin/') && href === '/admin/dashboard') {
        return false;
      }
      return true;
    }

    // Home page exact match
    if (href === '/' && pathname === '/') {
      return true;
    }

    return false;
  };

  return (
    <>
      {/* Bottom Navigation Bar */}
      <motion.nav
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="fixed bottom-0 left-0 right-0 h-18 bg-card/95 backdrop-blur-xl border-t border-white/20 shadow-xl z-50 md:hidden"
      >
        <div className="flex items-center justify-around h-full px-4 py-2">
          {/* Main Navigation Items */}
          {mainNavLinks.map(({ label, href, icon: Icon, exactPath }) => {
            const isActive = isLinkActive(href, exactPath);
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  "flex flex-col items-center justify-center w-full h-full px-2",
                  "transition-all duration-200 ease-in-out",
                  isActive
                    ? "text-primary scale-110 font-medium"
                    : "text-muted-foreground hover:text-primary/80"
                )}
              >
                <div className={clsx(
                  "relative p-2 rounded-xl mb-1",
                  isActive ? "bg-primary/10" : "bg-transparent"
                )}>
                  <Icon
                    className={clsx(
                      "transition-all",
                      isActive ? "h-6 w-6 stroke-[2.5]" : "h-5 w-5 stroke-[1.5]"
                    )}
                  />
                  {isActive && (
                    <span className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full" />
                  )}
                </div>
                <span className={clsx(
                  "text-xs",
                  isActive ? "font-medium" : "font-normal"
                )}>{label}</span>
              </Link>
            );
          })}

          {/* More Button - Only show if we have more than 5 links */}
          {hasMoreLinks && (
            <button
              onClick={handleMoreClick}
              className={clsx(
                "flex flex-col items-center justify-center w-full h-full px-2",
                "transition-all duration-200 ease-in-out",
                isMoreMenuOpen
                  ? "text-primary scale-110 font-medium"
                  : "text-muted-foreground hover:text-primary/80"
              )}
            >
              <div className={clsx(
                "relative p-2 rounded-xl mb-1",
                isMoreMenuOpen ? "bg-primary/10" : "bg-transparent"
              )}>
                <Menu
                  className={clsx(
                    "transition-all",
                    isMoreMenuOpen ? "h-6 w-6 stroke-[2.5]" : "h-5 w-5 stroke-[1.5]"
                  )}
                />
                {isMoreMenuOpen && (
                  <span className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 bg-primary rounded-full" />
                )}
              </div>
              <span className={clsx(
                "text-xs",
                isMoreMenuOpen ? "font-medium" : "font-normal"
              )}>More</span>
            </button>
          )}
        </div>
      </motion.nav>

      {/* More Menu Overlay */}
      <AnimatePresence>
        {isMoreMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsMoreMenuOpen(false);
                console.log("Backdrop clicked, closing menu");
              }}
            />

            {/* Menu */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-18 left-0 right-0 bg-card/95 backdrop-blur-xl border-t border-white/20 shadow-xl z-40 md:hidden rounded-t-2xl overflow-hidden"
            >
              <div className="p-6 space-y-3 max-h-[70vh] overflow-y-auto">
                {/* Drag handle */}
                <div className="w-12 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-5" />

                {/* Menu title */}
                <div className="text-center mb-5">
                  <h3 className="text-base font-semibold text-foreground">More Options</h3>
                </div>

                {/* Menu items */}
                <div className="grid grid-cols-1 gap-3">
                  {moreLinks.map(({ label, href, icon: Icon, exactPath }) => {
                    const isActive = isLinkActive(href, exactPath);
                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={() => setIsMoreMenuOpen(false)}
                        className={clsx(
                          "flex items-center gap-4 p-4 rounded-xl transition-all duration-200",
                          isActive
                            ? "bg-primary/15 text-primary font-medium shadow-sm"
                            : "text-foreground hover:bg-primary/5 hover:text-primary"
                        )}
                      >
                        <div className={clsx(
                          "p-2.5 rounded-lg",
                          isActive ? "bg-primary/20" : "bg-muted/30"
                        )}>
                          <Icon
                            className={clsx(
                              "transition-all",
                              isActive ? "h-5 w-5 stroke-[2.5]" : "h-5 w-5 stroke-[1.5]"
                            )}
                          />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium">{label}</span>
                          <span className="text-xs text-muted-foreground">
                            {isActive ? 'Currently active' : 'Tap to navigate'}
                          </span>
                        </div>
                        {isActive && (
                          <div className="ml-auto">
                            <CheckCircle className="h-5 w-5 text-primary" />
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>

                {/* Close button */}
                <button
                  onClick={() => setIsMoreMenuOpen(false)}
                  className="w-full mt-5 py-4 rounded-xl bg-primary/10 text-primary font-medium hover:bg-primary/15 transition-all duration-200"
                >
                  Close Menu
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
