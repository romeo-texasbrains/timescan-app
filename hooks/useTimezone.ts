'use client';

import { useContext } from 'react';
import { TimezoneContext } from '@/context/TimezoneContext';

/**
 * Custom hook for timezone management
 * Uses the TimezoneContext instead of making direct API calls
 * This prevents multiple API requests from different components
 */
export function useTimezone() {
  const context = useContext(TimezoneContext);

  if (!context) {
    console.warn('useTimezone must be used within a TimezoneProvider');
    return {
      timezone: 'UTC',
      isLoading: false,
      error: null,
      refreshTimezone: async () => {},
      updateTimezone: () => {},
      isTimezoneLoaded: false
    };
  }

  return {
    timezone: context.timezone,
    isLoading: context.isLoading,
    error: null, // Context doesn't expose error state
    refreshTimezone: context.refreshTimezone,
    updateTimezone: context.setTimezone,
    isTimezoneLoaded: true
  };
}

/**
 * Hook that returns just the timezone string
 * Useful for components that only need the timezone value
 */
export function useTimezoneValue(): string {
  const { timezone } = useTimezone();
  return timezone;
}

/**
 * Hook for formatting dates in the app timezone
 * Returns a function that formats dates using the current timezone
 */
export function useTimezoneFormatter() {
  const { timezone } = useTimezone();

  const formatInTimezone = (
    date: Date | string,
    formatString: string = 'yyyy-MM-dd HH:mm:ss'
  ): string => {
    // Import the formatting function directly to avoid creating manager instances
    const { formatInTimeZone } = require('date-fns-tz');
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    try {
      return formatInTimeZone(dateObj, timezone, formatString);
    } catch (error) {
      console.error('Error formatting date in timezone:', error);
      return formatInTimeZone(dateObj, 'UTC', formatString);
    }
  };

  return {
    timezone,
    formatInTimezone
  };
}
