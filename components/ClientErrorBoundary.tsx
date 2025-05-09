'use client';

import dynamic from 'next/dynamic';

// Dynamically import the ErrorBoundary component
const ErrorBoundary = dynamic(() => import('@/components/ErrorBoundary'), { ssr: false });

interface ClientErrorBoundaryProps {
  children: React.ReactNode;
}

export default function ClientErrorBoundary({ children }: ClientErrorBoundaryProps) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
