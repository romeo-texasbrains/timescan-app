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

  // Function to validate timezone
  const isValidTimezone = (tz: string): boolean => {
    try {
      // Try to create a formatter with the timezone to check if it's valid
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch (e) {
      return false;
    }
  };

  // Function to get friendly timezone abbreviation
  const getTimezoneAbbreviation = (tz: string): string => {
    // Common timezone abbreviations mapping
    const timezoneMap: Record<string, string> = {
      // North America
      'America/New_York': 'EST/EDT',
      'America/Chicago': 'CST/CDT',
      'America/Denver': 'MST/MDT',
      'America/Los_Angeles': 'PST/PDT',
      'America/Phoenix': 'MST',
      'America/Anchorage': 'AKST/AKDT',
      'America/Adak': 'HST/HDT',
      'America/Honolulu': 'HST',

      // Europe
      'Europe/London': 'GMT/BST',
      'Europe/Paris': 'CET/CEST',
      'Europe/Berlin': 'CET/CEST',
      'Europe/Moscow': 'MSK',
      'Europe/Athens': 'EET/EEST',

      // Asia
      'Asia/Karachi': 'PKT',
      'Asia/Kolkata': 'IST',
      'Asia/Tokyo': 'JST',
      'Asia/Shanghai': 'CST',
      'Asia/Dubai': 'GST',
      'Asia/Singapore': 'SGT',
      'Asia/Seoul': 'KST',

      // Australia
      'Australia/Sydney': 'AEST/AEDT',
      'Australia/Perth': 'AWST',
      'Australia/Adelaide': 'ACST/ACDT',

      // South America
      'America/Sao_Paulo': 'BRT/BRST',
      'America/Argentina/Buenos_Aires': 'ART',

      // Africa
      'Africa/Cairo': 'EET',
      'Africa/Johannesburg': 'SAST',

      // Default
      'UTC': 'UTC',
      'Etc/UTC': 'UTC',
      'Etc/GMT': 'GMT'
    };

    // Try to get the abbreviation from our map
    if (timezoneMap[tz]) {
      return timezoneMap[tz];
    }

    // If not in our map, try to extract from the timezone name
    const parts = tz.split('/');
    if (parts.length > 1) {
      // Try to create an abbreviation from the last part
      const lastPart = parts[parts.length - 1].replace(/_/g, ' ');

      // Special case for US timezones
      if (tz.startsWith('America/') && lastPart.includes(' ')) {
        // For cities with spaces like "New York", use initials
        return lastPart.split(' ').map(word => word[0]).join('') + 'T';
      }

      // For other cases, return the last part
      return lastPart;
    }

    // Fallback: use the Intl.DateTimeFormat to get the timezone name
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en', {
        timeZoneName: 'short',
        timeZone: tz
      });
      const formatted = formatter.format(now);
      // Extract the timezone abbreviation (usually after the comma)
      const match = formatted.match(/,\s*([A-Z]{3,5})/);
      if (match && match[1]) {
        return match[1];
      }
    } catch (e) {
      // Ignore errors
    }

    // Last resort: return the timezone as is
    return tz;
  };

  // Use a validated timezone or fall back to a default
  const safeTimezone = isValidTimezone(timezone) ? timezone : 'UTC';

  // Get the friendly timezone abbreviation
  const timezoneAbbr = getTimezoneAbbreviation(safeTimezone);

  useEffect(() => {
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
  }, [timezone, isMobile]); // Re-run effect if timezone or mobile state changes

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