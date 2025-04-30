'use client'

import { useState, useEffect } from 'react';
import { formatInTimeZone } from 'date-fns-tz';

interface TimeDisplayProps {
  timezone: string;
}

export default function TimeDisplay({ timezone }: TimeDisplayProps) {
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    const updateClock = () => {
      try {
        const now = new Date();
        // Format time as h:mm:ss a ZZZZ (e.g., 3:45:12 PM EST)
        setCurrentTime(formatInTimeZone(now, timezone, 'h:mm:ss a zzzz'));
        // Format date as PPPP (e.g., Wednesday, March 20th, 2024)
        setCurrentDate(formatInTimeZone(now, timezone, 'PPPP'));
      } catch (error) {
        console.error("Error formatting time in timezone:", timezone, error);
        setCurrentTime('Invalid Timezone');
        setCurrentDate('');
      }
    };

    updateClock(); // Initial update
    const intervalId = setInterval(updateClock, 1000); // Update every second

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [timezone]); // Re-run effect if timezone changes

  return (
    <div className="text-sm text-center md:text-right px-4 py-1 bg-muted/50 dark:bg-muted/80 text-muted-foreground rounded-md shadow-sm">
      <p className="font-medium">{currentTime}</p>
      <p className="text-xs">{currentDate}</p>
    </div>
  );
} 