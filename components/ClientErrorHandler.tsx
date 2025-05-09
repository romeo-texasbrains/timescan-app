'use client';

import dynamic from 'next/dynamic';

// Dynamically import the GlobalErrorHandler to avoid SSR issues
const GlobalErrorHandler = dynamic(() => import('@/components/GlobalErrorHandler'), { ssr: false });

export default function ClientErrorHandler() {
  return <GlobalErrorHandler />;
}
