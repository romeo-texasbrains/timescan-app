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
  return <ManagerDashboardContent initialData={initialData} />;
};

export default ClientWrapper;
