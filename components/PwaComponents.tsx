'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import client-only components with no SSR
const InstallPrompt = dynamic(() => import('@/components/InstallPrompt'), { ssr: false });
const NetworkStatus = dynamic(() => import('@/components/NetworkStatus'), { ssr: false });
const UpdateNotification = dynamic(() => import('@/components/UpdateNotification'), { ssr: false });

export default function PwaComponents() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Only render on client-side
  if (!mounted) return null;
  
  return (
    <>
      <NetworkStatus />
      <UpdateNotification />
      <InstallPrompt />
    </>
  );
}
