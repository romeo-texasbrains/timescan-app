'use client'

import { useState, useEffect } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { useMediaQuery } from '@/hooks/useMediaQuery';

interface TimeDisplayProps {
  timezone: string;
}

export default function TimeDisplay({ timezone }: TimeDisplayProps) {
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const isMobile = useMediaQuery('(max-width: 640px)');

  useEffect(() => {
    const updateClock = () => {
      try {
        const now = new Date();
        // Use simpler format for mobile
        if (isMobile) {
          // Format time as h:mm a (e.g., 3:45 PM)
          setCurrentTime(formatInTimeZone(now, timezone, 'h:mm a'));
          // Format date as EEE, MMM d (e.g., Thu, May 8)
          setCurrentDate(formatInTimeZone(now, timezone, 'EEE, MMM d'));
        } else {
          // Format time as h:mm:ss a zzzz (e.g., 3:45:12 PM EST)
          setCurrentTime(formatInTimeZone(now, timezone, 'h:mm:ss a zzzz'));
          // Format date as PPPP (e.g., Wednesday, March 20th, 2024)
          setCurrentDate(formatInTimeZone(now, timezone, 'PPPP'));
        }
      } catch (error) {
        console.error("Error formatting time in timezone:", timezone, error);
        setCurrentTime('Invalid Timezone');
        setCurrentDate('');
      }
    };

    updateClock(); // Initial update
    const intervalId = setInterval(updateClock, 1000); // Update every second

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [timezone, isMobile]); // Re-run effect if timezone or mobile state changes

  return (
    <div className="text-sm text-center md:text-right px-2 sm:px-4 py-1 bg-muted/50 dark:bg-muted/80 text-muted-foreground rounded-md shadow-sm max-w-[180px] sm:max-w-none overflow-hidden">
      <p className="font-medium truncate">{currentTime}</p>
      <p className="text-xs truncate">{currentDate}</p>
    </div>
  );
}