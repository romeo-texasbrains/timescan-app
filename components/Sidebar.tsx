"use client";
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { HomeIcon, QrCodeIcon, ClockIcon, UsersIcon, Cog6ToothIcon, ChartBarIcon, DocumentTextIcon, ArrowLeftOnRectangleIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';

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

export default function Sidebar({ role = 'user', onLogout }: { role?: UserRole, onLogout?: () => void }) {
  const pathname = usePathname();
  const links = sections[role] || sections.user;

  return (
    <motion.aside
      initial={{ x: -200, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 120 }}
      className="bg-blue-700 text-white w-64 min-h-screen flex flex-col shadow-xl z-20"
    >
      <div className="flex items-center gap-2 px-6 py-5 font-bold text-xl tracking-wide">
        <span className="inline-block w-7 h-7 bg-white rounded-full mr-2" />
        TimeScan
      </div>
      <nav className="flex-1 px-2 py-4">
        {links.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex items-center gap-3 px-4 py-2 my-1 rounded-lg hover:bg-blue-800 transition-colors',
              pathname === href && 'bg-blue-900 font-semibold shadow-lg'
            )}
          >
            <Icon className="h-5 w-5" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <div className="mt-auto px-4 pb-6">
        <button
          onClick={onLogout}
          className="flex items-center gap-2 w-full px-4 py-2 rounded-lg bg-blue-800 hover:bg-blue-900 transition-colors font-medium"
        >
          <ArrowLeftOnRectangleIcon className="h-5 w-5" />
          Logout
        </button>
      </div>
    </motion.aside>
  );
}
