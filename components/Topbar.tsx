"use client";
import { BellIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import TimeDisplay from './TimeDisplay';

interface TopbarProps {
  userEmail: string;
  timezone: string;
}

export default function Topbar({ userEmail, timezone }: TopbarProps) {
  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 100, delay: 0.2 }}
      className="flex items-center justify-between bg-card/80 dark:bg-card/80 backdrop-blur-lg border-b border-white/10 shadow px-4 sm:px-6 py-2 sticky top-0 z-20"
    >
      {/* Left side: Logo */}
      <div className="flex items-center">
         <Link href="/" className="relative flex items-center h-8 w-16">
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
      <div className="flex items-center gap-4 sm:gap-6">
        {/* Time Display - Placed before notifications/user */}
        <TimeDisplay timezone={timezone} />

        {/* Notification Icon */}
        <button className="relative p-1 rounded-full text-muted-foreground hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-primary" aria-label="Notifications" disabled>
          <BellIcon className="h-6 w-6" />
          {/* Optional: Notification count badge */}
          {/* <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400 ring-2 ring-white" /> */}
        </button>

        {/* User Info */}
        <div className="flex items-center gap-2">
          {/* Update icon/text colors */}
          <UserCircleIcon className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground" />
          <span className="hidden sm:inline font-medium text-sm text-foreground truncate max-w-[150px]">{userEmail}</span>
        </div>
      </div>
    </motion.header>
  );
}
