'use client';

import { useState, useEffect } from 'react';
import { useLoading } from '@/context/LoadingContext';

interface UseDataFetchingOptions {
  showGlobalLoader?: boolean;
}

export function useDataFetching<T>(
  fetchFn: () => Promise<T>,
  dependencies: any[] = [],
  options: UseDataFetchingOptions = { showGlobalLoader: false }
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { startLoading, stopLoading } = useLoading();

  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      setIsLoading(true);
      if (options.showGlobalLoader) {
        startLoading();
      }
      
      try {
        const result = await fetchFn();
        if (isMounted) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setData(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
        if (options.showGlobalLoader) {
          stopLoading();
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
      if (options.showGlobalLoader) {
        stopLoading();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return { data, error, isLoading };
}

export default useDataFetching;
