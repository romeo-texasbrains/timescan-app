'use client';

import { LoadingProvider } from '@/context/LoadingContext';
import ManagerDashboardContent from './ManagerDashboardContent';

export default function ClientWrapper({ initialData }: { initialData: any }) {
  return (
    <LoadingProvider>
      <ManagerDashboardContent initialData={initialData} />
    </LoadingProvider>
  );
}
