'use client';

import { LoadingProvider } from '@/components/LoadingContext';
import EmployeeDashboardContent from './EmployeeDashboardContent';

export default function ClientWrapper({ initialData }: { initialData: any }) {
  return (
    <LoadingProvider>
      <EmployeeDashboardContent initialData={initialData} />
    </LoadingProvider>
  );
}
