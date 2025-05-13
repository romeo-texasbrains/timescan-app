'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import LoadingSpinner from '@/components/LoadingSpinner';

// Dynamically import the AdminDashboardContent component
const AdminDashboardContent = dynamic(
  () => import('./AdminDashboardContent'),
  {
    loading: () => <div className="flex justify-center items-center min-h-screen"><LoadingSpinner size="lg" /></div>
  }
);

interface ClientWrapperProps {
  initialData: any;
}

const ClientWrapper: React.FC<ClientWrapperProps> = ({ initialData }) => {
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate checking if data is valid
    try {
      if (!initialData || typeof initialData !== 'object') {
        throw new Error('Invalid data received');
      }

      // Check if required properties exist
      const requiredProps = ['employeeStatuses', 'employeesByDepartment', 'departmentMap', 'today'];
      for (const prop of requiredProps) {
        if (!(prop in initialData)) {
          throw new Error(`Missing required property: ${prop}`);
        }
      }

      // Ensure today is a valid date
      if (!(initialData.today instanceof Date)) {
        initialData.today = new Date(initialData.today);
      }

      // Debug: Log the total active time from server
      const totalActiveTime = initialData.employeeStatuses.reduce((total, emp) => total + emp.totalActiveTime, 0);
      console.log('Server-side total active time:', totalActiveTime, 'seconds');
      console.log('Server-side total active time formatted:',
        Math.floor(totalActiveTime / 3600) + 'h ' +
        Math.floor((totalActiveTime % 3600) / 60) + 'm');

      // Debug: Log each employee's active time
      initialData.employeeStatuses.forEach(emp => {
        console.log(`Employee ${emp.name} active time: ${emp.totalActiveTime} seconds`);
      });

      setIsLoading(false);
    } catch (err) {
      console.error('Error in ClientWrapper:', err);
      setError(err instanceof Error ? err : new Error('Unknown error'));
      setIsLoading(false);
    }
  }, [initialData]);

  if (isLoading) {
    return <div className="flex justify-center items-center min-h-screen"><LoadingSpinner size="lg" /></div>;
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          <h2 className="text-lg font-semibold mb-2">Error Loading Dashboard</h2>
          <p>There was a problem with the dashboard data. Please try refreshing the page.</p>
          <p className="text-sm mt-2">Error details: {error.message}</p>
        </div>
        <div className="flex justify-center mt-4">
          <a href="/admin" className="px-4 py-2 bg-primary text-primary-foreground rounded-md">
            Return to Admin Panel
          </a>
        </div>
      </div>
    );
  }

  return <AdminDashboardContent initialData={initialData} />;
};

export default ClientWrapper;
