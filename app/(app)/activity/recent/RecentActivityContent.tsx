'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useLoading } from '@/context/LoadingContext';

interface RecentActivityContentProps {
  initialData: {
    logs: any[];
    timezone: string;
    departments?: any[];
    users?: any[];
    userRole: 'admin' | 'manager' | 'employee';
  };
}

export default function RecentActivityContent({ initialData }: RecentActivityContentProps) {
  // Extract data from props with safety checks
  const {
    logs: initialLogs = [],
    timezone: initialTimezone = 'UTC',
    departments: initialDepartments = [],
    users: initialUsers = [],
    userRole: initialUserRole = 'employee'
  } = initialData || {};

  // State for filters and data
  const [logs, setLogs] = useState<any[]>(initialLogs);
  const [timezone, setTimezone] = useState<string>(initialTimezone);
  const [departments, setDepartments] = useState<any[]>(initialDepartments);
  const [users, setUsers] = useState<any[]>(initialUsers);
  const [userRole, setUserRole] = useState<string>(initialUserRole);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [limit, setLimit] = useState<number>(20);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isClient, setIsClient] = useState<boolean>(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

  const { stopLoading } = useLoading();

  // Initialize state with initial data
  useEffect(() => {
    setLogs(initialLogs);
    setTimezone(initialTimezone);
    setDepartments(initialDepartments);
    setUsers(initialUsers);
    setUserRole(initialUserRole);
    setIsClient(true);
    stopLoading();
  }, [
    initialLogs,
    initialTimezone,
    initialDepartments,
    initialUsers,
    initialUserRole,
    stopLoading
  ]);

  // Function to fetch recent activity
  const fetchRecentActivity = async () => {
    setIsLoading(true);

    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append('limit', limit.toString());

      if (selectedUserId) {
        params.append('userId', selectedUserId);
      }

      if (selectedDepartmentId) {
        params.append('departmentId', selectedDepartmentId);
      }

      // Fetch data from API
      const response = await fetch(`/api/activity/recent?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API error: ${errorData.error || response.statusText}`);
      }

      const data = await response.json();

      // Update state with fetched data
      setLogs(data.logs || []);
      setTimezone(data.timezone);
      setLastUpdateTime(new Date());

      toast.success('Recent activity loaded successfully');
    } catch (error) {
      console.error('Error fetching recent activity:', error);
      toast.error('Failed to load recent activity');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle filter changes
  const handleApplyFilters = () => {
    fetchRecentActivity();
  };

  // Helper function to format event type
  function formatEventType(eventType: string): string {
    switch (eventType) {
      case 'signin': return 'Sign In';
      case 'signout': return 'Sign Out';
      case 'break_start': return 'Break Start';
      case 'break_end': return 'Break End';
      default: return eventType;
    }
  }

  // Render filters
  const renderFilters = () => (
    <div className="flex flex-col md:flex-row gap-4 mb-6">
      {(userRole === 'admin' || userRole === 'manager') && (
        <>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Department</label>
            <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Departments</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">User</label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Users</SelectItem>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Limit</label>
        <Select value={limit.toString()} onValueChange={(value) => setLimit(parseInt(value, 10))}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="20" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10 events</SelectItem>
            <SelectItem value="20">20 events</SelectItem>
            <SelectItem value="50">50 events</SelectItem>
            <SelectItem value="100">100 events</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-end">
        <Button onClick={handleApplyFilters} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Apply Filters'}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Recent Activity</h1>
          <p className="text-muted-foreground mt-1">
            View recent attendance events
          </p>
        </div>
        <div className="flex items-center space-x-4 mt-4 md:mt-0">
          <div className="text-sm text-muted-foreground">
            <span>Timezone: </span>
            <span className="font-medium">{timezone}</span>
            {lastUpdateTime && (
              <>
                <span className="mx-2">•</span>
                <span>Last updated: </span>
                <span className="font-medium">
                  {new Intl.DateTimeFormat('en-US', {
                    hour: 'numeric',
                    minute: 'numeric',
                    hour12: true,
                    timeZone: timezone
                  }).format(lastUpdateTime)}
                </span>
              </>
            )}
          </div>
          <Button
            onClick={fetchRecentActivity}
            className="inline-flex items-center px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors text-sm"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Refreshing...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                Refresh
              </>
            )}
          </Button>
        </div>
      </div>

      {renderFilters()}

      <Card>
        <CardHeader>
          <CardTitle>Activity Events</CardTitle>
          <CardDescription>
            Recent attendance events
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Date</th>
                    <th className="text-left py-2 font-medium">Time</th>
                    <th className="text-left py-2 font-medium">Event</th>
                    {(userRole === 'admin' || userRole === 'manager') && (
                      <>
                        <th className="text-left py-2 font-medium">User</th>
                        <th className="text-left py-2 font-medium">Department</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b">
                      <td className="py-2">{log.formattedDate}</td>
                      <td className="py-2">{log.formattedTime}</td>
                      <td className="py-2">{formatEventType(log.eventType)}</td>
                      {(userRole === 'admin' || userRole === 'manager') && (
                        <>
                          <td className="py-2">{log.userName}</td>
                          <td className="py-2">{log.departmentName || 'Unassigned'}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-4 text-center text-muted-foreground">
              No activity events found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
