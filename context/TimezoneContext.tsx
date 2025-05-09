'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface TimezoneContextType {
  timezone: string;
  setTimezone: (timezone: string) => void; // Optional: if you need to update it client-side
}

// Provide a default value matching the server-side default
const defaultTimezoneContextValue: TimezoneContextType = {
  timezone: 'UTC',
  setTimezone: () => { console.warn('setTimezone called without a Provider') },
};

export const TimezoneContext = createContext<TimezoneContextType>(defaultTimezoneContextValue);

interface TimezoneProviderProps {
  initialTimezone: string;
  children: ReactNode;
}

// This Provider is intended to wrap client components *within* the server layout
// It gets the initial value from the server layout props
// Helper function to validate a timezone (defined outside component to be reusable)
const isValidTimezone = (tz: string): boolean => {
  if (!tz || typeof tz !== 'string') return false;

  try {
    // Try to create a formatter with the timezone to check if it's valid
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch (e) {
    console.warn(`Invalid timezone: ${tz}`, e);
    return false;
  }
};

export const TimezoneProvider = ({ initialTimezone, children }: TimezoneProviderProps) => {
  // Validate the initial timezone before using it
  const validInitialTimezone = isValidTimezone(initialTimezone) ? initialTimezone : 'UTC';

  // Although we get the initial value from server props, useState is needed
  // if we ever want to allow client-side updates or reactions to changes.
  // For now, it mainly holds the server-provided value.
  const [timezone, setTimezoneState] = useState<string>(validInitialTimezone);

  // We're using the isValidTimezone function defined above

  // Wrapper function with validation
  const setTimezone = (newTimezone: string) => {
    // Validate the timezone before setting it
    if (isValidTimezone(newTimezone)) {
      setTimezoneState(newTimezone);
    } else {
      console.warn(`Attempted to set invalid timezone: ${newTimezone}, falling back to UTC`);
      setTimezoneState('UTC');
    }
  };

  return (
    <TimezoneContext.Provider value={{ timezone, setTimezone }}>
      {children}
    </TimezoneContext.Provider>
  );
};

// Custom hook for easy consumption
export const useTimezone = () => useContext(TimezoneContext);