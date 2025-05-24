'use client';

import { LoadingProvider } from '@/components/LoadingContext';
import RecentActivityContent from './RecentActivityContent';

export default function ClientWrapper({ initialData }: { initialData: any }) {
  return (
    <LoadingProvider>
      <RecentActivityContent initialData={initialData} />
    </LoadingProvider>
  );
}
