'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';

interface LoadingContextType {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  startLoading: () => void;
  stopLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType>({
  isLoading: false,
  setLoading: () => {},
  startLoading: () => {},
  stopLoading: () => {},
});

export const useLoading = () => useContext(LoadingContext);

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Track route changes to show loading state
  useEffect(() => {
    // Start loading when route changes
    startLoading();
    
    // Stop loading after a short delay to ensure components have rendered
    const timer = setTimeout(() => {
      stopLoading();
    }, 500);
    
    return () => clearTimeout(timer);
  }, [pathname, searchParams]);

  const startLoading = () => setIsLoading(true);
  const stopLoading = () => setIsLoading(false);

  return (
    <LoadingContext.Provider value={{ isLoading, setLoading: setIsLoading, startLoading, stopLoading }}>
      {children}
      {isLoading && <LoadingSpinner fullScreen size="lg" />}
    </LoadingContext.Provider>
  );
};

export default LoadingProvider;
