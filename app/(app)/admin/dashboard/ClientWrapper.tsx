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
    // Validate and sanitize data
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

      // Sanitize department map to ensure all entries have proper structure
      if (initialData.departmentMap && typeof initialData.departmentMap === 'object') {
        const sanitizedDeptMap = {};

        // Process each department entry
        Object.entries(initialData.departmentMap).forEach(([id, deptInfo]) => {
          // Default department structure
          const sanitizedDept = {
            name: 'Unknown Department',
            shift_start_time: null,
            shift_end_time: null,
            grace_period_minutes: 30
          };

          // Extract and validate department info
          if (deptInfo) {
            if (typeof deptInfo === 'string') {
              // If it's just a string, use it as the name
              sanitizedDept.name = deptInfo;
            } else if (typeof deptInfo === 'object' && deptInfo !== null) {
              // Extract name with fallback
              sanitizedDept.name = typeof deptInfo.name === 'string' && deptInfo.name.trim() !== ''
                ? deptInfo.name
                : `Department ${id}`;

              // Extract other properties if they exist
              if ('shift_start_time' in deptInfo) sanitizedDept.shift_start_time = deptInfo.shift_start_time;
              if ('shift_end_time' in deptInfo) sanitizedDept.shift_end_time = deptInfo.shift_end_time;
              if ('grace_period_minutes' in deptInfo && typeof deptInfo.grace_period_minutes === 'number') {
                sanitizedDept.grace_period_minutes = deptInfo.grace_period_minutes;
              }
            }
          }

          // Store the sanitized department
          sanitizedDeptMap[id] = sanitizedDept;
        });

        // Replace the original department map with the sanitized one
        initialData.departmentMap = sanitizedDeptMap;
      }

      // Add special handling for 'unassigned' department if it doesn't exist
      if (!initialData.departmentMap['unassigned']) {
        initialData.departmentMap['unassigned'] = {
          name: 'Unassigned',
          shift_start_time: null,
          shift_end_time: null,
          grace_period_minutes: 30
        };
      }

      // Debug: Log the total active time from server
      const totalActiveTime = initialData.employeeStatuses.reduce((total, emp) => total + (emp.totalActiveTime || 0), 0);
      console.log('Server-side total active time:', totalActiveTime, 'seconds');
      console.log('Server-side total active time formatted:',
        Math.floor(totalActiveTime / 3600) + 'h ' +
        Math.floor((totalActiveTime % 3600) / 60) + 'm');

      // Debug: Log sanitized department map
      console.log('Sanitized department map:', initialData.departmentMap);

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

  // CRITICAL FIX: Ensure department map is properly structured
  // This is a last line of defense before rendering
  try {
    // Check if we've seen the localeCompare error before
    let hasSeenLocaleCompareError = false;
    try {
      hasSeenLocaleCompareError = localStorage.getItem('localeCompareErrorSeen') === 'true';
    } catch (e) {
      // Ignore localStorage errors
    }

    // ULTRA-AGGRESSIVE FIX: If we've seen the error before, use the simplest possible approach
    if (hasSeenLocaleCompareError) {
      console.log('Previously encountered localeCompare error - using ultra-safe approach');

      // Just use a simple string-only map with no complex objects
      initialData.departmentMap = {
        'unassigned': 'Unassigned'
      };

      // Add other departments as simple strings
      if (typeof initialData.departmentMap === 'object') {
        Object.entries(initialData.departmentMap).forEach(([id, dept]) => {
          if (id !== 'unassigned') {
            if (typeof dept === 'object' && dept !== null && 'name' in dept) {
              initialData.departmentMap[id] = String(dept.name || `Department ${id}`);
            } else if (typeof dept === 'string') {
              initialData.departmentMap[id] = dept;
            } else {
              initialData.departmentMap[id] = `Department ${id}`;
            }
          }
        });
      }
    }
    // Normal approach if we haven't seen the error
    else if (initialData.departmentMap && typeof initialData.departmentMap === 'object') {
      // Create a new sanitized department map
      const sanitizedDeptMap = {};

      // Process each department
      Object.entries(initialData.departmentMap).forEach(([id, dept]) => {
        if (!id) return; // Skip if ID is missing

        // Create a default department structure
        sanitizedDeptMap[id] = {
          name: `Department ${id}`,
          shift_start_time: null,
          shift_end_time: null,
          grace_period_minutes: 30
        };

        // Try to extract information from the original department
        try {
          if (dept) {
            // Handle string departments
            if (typeof dept === 'string') {
              sanitizedDeptMap[id].name = String(dept);
            }
            // Handle object departments
            else if (typeof dept === 'object' && dept !== null) {
              // Extract name with validation
              if ('name' in dept && dept.name !== null && dept.name !== undefined) {
                sanitizedDeptMap[id].name = String(dept.name);
              }

              // Extract other properties
              if ('shift_start_time' in dept) sanitizedDeptMap[id].shift_start_time = dept.shift_start_time;
              if ('shift_end_time' in dept) sanitizedDeptMap[id].shift_end_time = dept.shift_end_time;
              if ('grace_period_minutes' in dept && typeof dept.grace_period_minutes === 'number') {
                sanitizedDeptMap[id].grace_period_minutes = dept.grace_period_minutes;
              }
            }
          }
        } catch (e) {
          // Keep the default values if extraction fails
        }
      });

      // Ensure 'unassigned' department exists
      sanitizedDeptMap['unassigned'] = {
        name: 'Unassigned',
        shift_start_time: null,
        shift_end_time: null,
        grace_period_minutes: 30
      };

      // Replace the original department map
      initialData.departmentMap = sanitizedDeptMap;
    } else {
      // Create a minimal department map if none exists
      initialData.departmentMap = {
        'unassigned': {
          name: 'Unassigned',
          shift_start_time: null,
          shift_end_time: null,
          grace_period_minutes: 30
        }
      };
    }
  } catch (error) {
    console.error('Error sanitizing department map:', error);
    // Create a minimal department map as fallback - ultra simple
    initialData.departmentMap = {
      'unassigned': 'Unassigned'
    };
  }

  return <AdminDashboardContent initialData={initialData} />;
};

export default ClientWrapper;
