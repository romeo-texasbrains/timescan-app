'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ClientTimezoneManager, isValidTimezone } from '@/lib/utils/timezone-client';

interface TimezoneContextType {
  timezone: string;
  setTimezone: (timezone: string) => void;
  refreshTimezone: () => Promise<void>; // New function to refresh timezone from server
  isLoading: boolean; // Loading state for timezone refresh
}

// Provide a default value matching the server-side default
const defaultTimezoneContextValue: TimezoneContextType = {
  timezone: 'UTC',
  setTimezone: () => { console.warn('setTimezone called without a Provider') },
  refreshTimezone: async () => { console.warn('refreshTimezone called without a Provider') },
  isLoading: false,
};

export const TimezoneContext = createContext<TimezoneContextType>(defaultTimezoneContextValue);

interface TimezoneProviderProps {
  initialTimezone: string;
  children: ReactNode;
}

export const TimezoneProvider = ({ initialTimezone, children }: TimezoneProviderProps) => {
  // Get the singleton timezone manager instance
  const timezoneManager = ClientTimezoneManager.getInstance();

  // Validate the initial timezone before using it
  const validInitialTimezone = isValidTimezone(initialTimezone) ? initialTimezone : 'UTC';

  console.log(`TimezoneProvider: Received initialTimezone: ${initialTimezone}, validInitialTimezone: ${validInitialTimezone}`);

  // State for timezone and loading status
  const [timezone, setTimezoneState] = useState<string>(validInitialTimezone);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Function to fetch the timezone from the server using the manager
  const refreshTimezone = async () => {
    try {
      setIsLoading(true);
      console.log('TimezoneContext: Refreshing timezone...');

      // Use the timezone manager which handles caching and deduplication
      const newTimezone = await timezoneManager.getTimezone(true); // Force refresh

      if (isValidTimezone(newTimezone)) {
        setTimezoneState(newTimezone);
        console.log(`TimezoneContext: Timezone updated to ${newTimezone}`);
      } else {
        console.warn(`TimezoneManager returned invalid timezone: ${newTimezone}, falling back to UTC`);
        setTimezoneState('UTC');
      }
    } catch (error) {
      console.error('TimezoneContext: Error refreshing timezone:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Wrapper function with validation for manual timezone updates
  const setTimezone = (newTimezone: string) => {
    // Validate the timezone before setting it
    if (isValidTimezone(newTimezone)) {
      setTimezoneState(newTimezone);
      // Clear the manager cache so it fetches fresh data next time
      timezoneManager.clearCache();
    } else {
      console.warn(`Attempted to set invalid timezone: ${newTimezone}, falling back to UTC`);
      setTimezoneState('UTC');
    }
  };

  // Initialize timezone when component mounts
  useEffect(() => {
    let mounted = true;

    console.log(`TimezoneContext: Initializing with timezone: ${validInitialTimezone}`);

    // If we have a valid initial timezone, use it and don't make API calls
    if (isValidTimezone(initialTimezone)) {
      console.log('TimezoneContext: Using valid initial timezone, no API call needed');
      // Pre-populate the manager cache to avoid future API calls
      timezoneManager.setTimezone(validInitialTimezone);
      return; // Don't set up intervals or make API calls
    }

    // Only make API calls if we don't have a valid initial timezone
    const initializeTimezone = async () => {
      try {
        console.log('TimezoneContext: No valid initial timezone, fetching from server...');

        // Try to get timezone from manager (uses cache if available)
        const cachedTimezone = await timezoneManager.getTimezone(false);

        if (mounted && isValidTimezone(cachedTimezone)) {
          setTimezoneState(cachedTimezone);
          console.log(`TimezoneContext: Initialized with timezone ${cachedTimezone}`);
        } else if (mounted) {
          // Fallback to UTC if manager fails
          setTimezoneState('UTC');
          console.log('TimezoneContext: Fallback to UTC');
        }
      } catch (error) {
        console.error('TimezoneContext: Error initializing timezone:', error);
        if (mounted) {
          setTimezoneState('UTC');
        }
      }
    };

    // Only initialize and set up intervals if we don't have a valid initial timezone
    if (!isValidTimezone(initialTimezone)) {
      initializeTimezone();

      // Set up an interval to refresh the timezone every 30 minutes (reduced frequency)
      // Only if we had to fetch from server initially
      const intervalId = setInterval(() => {
        if (mounted) {
          console.log('TimezoneContext: Periodic refresh (30min interval)');
          refreshTimezone();
        }
      }, 30 * 60 * 1000); // Changed from 5 minutes to 30 minutes

      return () => {
        mounted = false;
        clearInterval(intervalId);
      };
    } else {
      // If we have a valid initial timezone, just clean up on unmount
      return () => {
        mounted = false;
      };
    }
  }, [initialTimezone]); // Removed validInitialTimezone from dependencies

  return (
    <TimezoneContext.Provider value={{ timezone, setTimezone, refreshTimezone, isLoading }}>
      {children}
    </TimezoneContext.Provider>
  );
};

// Custom hook for easy consumption
export const useTimezone = () => useContext(TimezoneContext);