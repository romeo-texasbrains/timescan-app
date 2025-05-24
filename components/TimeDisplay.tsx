'use client'

import { useState, useEffect } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useTimezone } from '@/context/TimezoneContext';
import { isValidTimezone, getTimezoneAbbreviation } from '@/lib/utils/timezone-client';

interface TimeDisplayProps {
  timezone: string; // This is the prop passed from the parent, but we'll use context instead
}

export default function TimeDisplay({ timezone: propTimezone }: TimeDisplayProps) {
  const { timezone: contextTimezone } = useTimezone(); // Get timezone from context
  const timezone = contextTimezone || propTimezone; // Use context timezone if available, otherwise use prop

  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [timezoneAbbr, setTimezoneAbbr] = useState('');
  const isMobile = useMediaQuery('(max-width: 640px)');

  // Use a validated timezone or fall back to a default
  const safeTimezone = isValidTimezone(timezone) ? timezone : 'UTC';

  // Update the clock and timezone abbreviation when the timezone changes
  useEffect(() => {
    // Show the timezone name instead of abbreviation
    // Convert "Asia/Karachi" to just "Karachi" for cleaner display
    const formatTimezoneDisplay = (tz: string): string => {
      const parts = tz.split('/');
      if (parts.length > 1) {
        // Return the last part (city name) with underscores replaced by spaces
        return parts[parts.length - 1].replace(/_/g, ' ');
      }
      return tz.replace(/_/g, ' ');
    };

    setTimezoneAbbr(formatTimezoneDisplay(safeTimezone));

    const updateClock = () => {
      try {
        const now = new Date();

        // Use simpler format for mobile
        if (isMobile) {
          // Format time as h:mm a (e.g., 3:45 PM)
          setCurrentTime(formatInTimeZone(now, safeTimezone, 'h:mm a'));
          // Format date as EEE, MMM d (e.g., Thu, May 8)
          const formattedDate = formatInTimeZone(now, safeTimezone, 'EEE, MMM d');
          setCurrentDate(formattedDate);
        } else {
          // Format time as h:mm:ss a (e.g., 3:45:12 PM)
          setCurrentTime(formatInTimeZone(now, safeTimezone, 'h:mm:ss a'));
          // Format date as PPPP (e.g., Wednesday, March 20th, 2024)
          const formattedDate = formatInTimeZone(now, safeTimezone, 'PPPP');
          setCurrentDate(formattedDate);
        }

        // If we're using the fallback timezone, show a warning in the UI
        if (safeTimezone !== timezone) {
          setCurrentTime(prev => prev + ' (UTC)');
        }
      } catch (error) {
        console.error("Error formatting time:", error);
        setCurrentTime('Clock Error');
        setCurrentDate('Using UTC time');
      }
    };

    updateClock(); // Initial update
    const intervalId = setInterval(updateClock, 1000); // Update every second

    return () => clearInterval(intervalId); // Cleanup on unmount
  }, [timezone, isMobile, safeTimezone]); // Re-run effect if timezone or mobile state changes

  return (
    <div className="text-sm text-center md:text-right px-2 sm:px-4 py-1 bg-muted/50 dark:bg-muted/80 text-muted-foreground rounded-md shadow-sm max-w-[200px] sm:max-w-none overflow-hidden">
      <div className="flex items-center justify-center md:justify-end gap-1">
        <p className="font-medium truncate">{currentTime}</p>
        <span className="text-xs bg-primary/10 px-1 py-0.5 rounded font-medium">{timezoneAbbr}</span>
      </div>
      <p className="text-xs truncate">{currentDate}</p>
    </div>
  );
}