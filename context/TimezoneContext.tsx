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
export const TimezoneProvider = ({ initialTimezone, children }: TimezoneProviderProps) => {
  // Although we get the initial value from server props, useState is needed
  // if we ever want to allow client-side updates or reactions to changes.
  // For now, it mainly holds the server-provided value.
  const [timezone, setTimezoneState] = useState<string>(initialTimezone || 'UTC');

  // Wrapper function in case we add validation or side effects later
  const setTimezone = (newTimezone: string) => {
    setTimezoneState(newTimezone);
    // Potentially save to localStorage or trigger other updates if needed
  };

  return (
    <TimezoneContext.Provider value={{ timezone, setTimezone }}>
      {children}
    </TimezoneContext.Provider>
  );
};

// Custom hook for easy consumption
export const useTimezone = () => useContext(TimezoneContext); 