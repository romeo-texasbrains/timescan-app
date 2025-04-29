"use client";
import { BellIcon, MagnifyingGlassIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

export default function Topbar({ userEmail }: { userEmail: string }) {
  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 100, delay: 0.2 }}
      className="flex items-center justify-between bg-white dark:bg-gray-900 shadow px-6 py-3 sticky top-0 z-10"
    >
      <div className="flex items-center gap-4">
        <MagnifyingGlassIcon className="h-6 w-6 text-gray-400" />
        <input
          type="text"
          placeholder="Search here..."
          className="bg-transparent outline-none border-b border-gray-200 dark:border-gray-700 px-2 py-1 text-gray-700 dark:text-gray-200"
        />
      </div>
      <div className="flex items-center gap-6">
        <BellIcon className="h-6 w-6 text-gray-400 hover:text-blue-600 transition-colors cursor-pointer" />
        <div className="flex items-center gap-2">
          <UserCircleIcon className="h-8 w-8 text-blue-700" />
          <span className="font-semibold text-gray-700 dark:text-gray-100">{userEmail}</span>
        </div>
      </div>
    </motion.header>
  );
}
