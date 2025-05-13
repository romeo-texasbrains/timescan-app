'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import LoadingSpinner from '@/components/LoadingSpinner';

// Dynamically import the ManagerDashboardContent component
const ManagerDashboardContent = dynamic(
  () => import('./ManagerDashboardContent'),
  {
    loading: () => <div className="flex justify-center items-center min-h-screen"><LoadingSpinner size="lg" /></div>
  }
);

interface ClientWrapperProps {
  initialData: any;
}

const ClientWrapper: React.FC<ClientWrapperProps> = ({ initialData }) => {
  // Debug: Log the total active time from server
  if (initialData && initialData.employeeStatuses) {
    const totalActiveTime = initialData.employeeStatuses.reduce((total, emp) => total + emp.totalActiveTime, 0);
    console.log('Manager dashboard - Server-side total active time:', totalActiveTime, 'seconds');
    console.log('Manager dashboard - Server-side total active time formatted:',
      Math.floor(totalActiveTime / 3600) + 'h ' +
      Math.floor((totalActiveTime % 3600) / 60) + 'm');

    // Debug: Log each employee's active time
    initialData.employeeStatuses.forEach(emp => {
      console.log(`Manager dashboard - Employee ${emp.name} active time: ${emp.totalActiveTime} seconds`);
    });
  }

  return <ManagerDashboardContent initialData={initialData} />;
};

export default ClientWrapper;
