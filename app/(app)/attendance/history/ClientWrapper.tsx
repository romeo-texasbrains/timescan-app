'use client';

import { LoadingProvider } from '@/components/LoadingContext';
import AttendanceHistoryContent from './AttendanceHistoryContent';

export default function ClientWrapper({ initialData }: { initialData: any }) {
  return (
    <LoadingProvider>
      <AttendanceHistoryContent initialData={initialData} />
    </LoadingProvider>
  );
}
