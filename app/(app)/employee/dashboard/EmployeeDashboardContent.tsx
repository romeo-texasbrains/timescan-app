'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { parseISO } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useLoading } from '@/components/LoadingContext';

interface EmployeeDashboardContentProps {
  initialData: {
    userStatus: any;
    activeTime: number;
    breakTime: number;
    recentLogs: any[];
    recentActivity?: any[];
    dailyStats: any[];
    department: any;
    today: Date;
    timezone: string;
  };
}

export default function EmployeeDashboardContent({ initialData }: EmployeeDashboardContentProps) {
  // Extract data from props with safety checks
  const {
    userStatus: initialUserStatus = null,
    activeTime: initialActiveTime = 0,
    breakTime: initialBreakTime = 0,
    recentLogs: initialRecentLogs = [],
    recentActivity: initialRecentActivity = [],
    dailyStats: initialDailyStats = [],
    department: initialDepartment = {},
    today: initialToday = new Date(),
    timezone: initialTimezone = 'UTC'
  } = initialData || {};

  // State for real-time data
  const [userStatus, setUserStatus] = useState<any>(initialUserStatus);
  const [activeTime, setActiveTime] = useState<number>(initialActiveTime);
  const [breakTime, setBreakTime] = useState<number>(initialBreakTime);
  const [recentLogs, setRecentLogs] = useState<any[]>(initialRecentLogs);
  const [recentActivity, setRecentActivity] = useState<any[]>(initialRecentActivity);
  const [dailyStats, setDailyStats] = useState<any[]>(initialDailyStats);
  const [department, setDepartment] = useState<any>(initialDepartment);
  const [timezone, setTimezone] = useState<string>(initialTimezone);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [isClient, setIsClient] = useState<boolean>(false);
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState<boolean>(true);

  const { stopLoading } = useLoading();

  // Initialize state with initial data
  useEffect(() => {
    setUserStatus(initialUserStatus);
    setActiveTime(initialActiveTime);
    setBreakTime(initialBreakTime);
    setRecentLogs(initialRecentLogs);
    setRecentActivity(initialRecentActivity);
    setDailyStats(initialDailyStats);
    setDepartment(initialDepartment);
    setTimezone(initialTimezone);
    setIsClient(true);
    stopLoading();
  }, [
    initialUserStatus,
    initialActiveTime,
    initialBreakTime,
    initialRecentLogs,
    initialRecentActivity,
    initialDailyStats,
    initialDepartment,
    initialTimezone,
    stopLoading
  ]);

  // Set up real-time subscription
  useEffect(() => {
    if (!isClient) return;

    const supabase = createClient();
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    // Create a channel for real-time updates
    const channel = supabase.channel('employee-dashboard-changes');

    // Subscribe to attendance_logs table changes for the current user
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'attendance_logs',
      filter: `user_id=eq.${userStatus?.id}`
    }, async (payload) => {
      console.log('Real-time attendance log update received:', payload);

      try {
        // Fetch updated data
        await refreshDashboardData();
        setLastUpdateTime(new Date());
        toast.success('Dashboard updated with new attendance data');
      } catch (error) {
        console.error('Error refreshing dashboard data after attendance log change:', error);
        toast.error('Failed to update dashboard data');
      }
    });

    // Subscribe to attendance_adherence table changes
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'attendance_adherence',
      filter: `user_id=eq.${userStatus?.id}`
    }, async (payload) => {
      console.log('Real-time adherence update received:', payload);

      try {
        // Show a more specific toast for adherence changes
        if (payload.new && payload.old) {
          // Status changed
          if (payload.new.status !== payload.old.status) {
            toast.info(`Your adherence status changed to ${payload.new.status}`);
          }
        }

        // Fetch updated data
        await refreshDashboardData();
        setLastUpdateTime(new Date());
      } catch (error) {
        console.error('Error refreshing dashboard data after adherence change:', error);
        toast.error('Failed to update dashboard data');
      }
    });

    // Subscribe to the channel
    const subscription = channel.subscribe();

    // Refresh data every 3 minutes as a fallback
    const intervalId = setInterval(async () => {
      if (isRealTimeEnabled) {
        try {
          console.log('Performing scheduled employee dashboard refresh...');
          await refreshDashboardData();
          setLastUpdateTime(new Date());
          console.log('Scheduled employee dashboard refresh completed successfully');
        } catch (error) {
          console.error('Error in scheduled employee dashboard refresh:', error);
        }
      }
    }, 3 * 60 * 1000);

    // Cleanup function
    return () => {
      supabase.removeChannel(channel);
      clearInterval(intervalId);
      console.log('Cleaned up real-time subscription and interval for employee dashboard');
    };
  }, [isClient, userStatus?.id, isRealTimeEnabled]);

  // Function to refresh dashboard data using the unified API endpoint
  const refreshDashboardData = async () => {
    try {
      console.log('Fetching dashboard data from employee API endpoint...');

      // Call the employee dashboard API endpoint
      const response = await fetch('/api/dashboard/user', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // Ensure we always get fresh data
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API error: ${errorData.error || response.statusText}`);
      }

      const dashboardData = await response.json();
      console.log('Employee dashboard data fetched successfully');

      // Update all state variables with the fresh data
      setUserStatus(dashboardData.userStatus || null);
      setActiveTime(dashboardData.activeTime || 0);
      setBreakTime(dashboardData.breakTime || 0);
      setRecentLogs(dashboardData.recentLogs || []);
      setDailyStats(dashboardData.dailyStats || []);
      setDepartment(dashboardData.department || {});
      setTimezone(dashboardData.timezone || 'UTC');

      // Fetch recent activity separately using the dedicated API
      await refreshRecentActivity();

      // Log some debug information
      console.log(`Refreshed employee dashboard data: ${dashboardData.activeTime} active seconds, ${dashboardData.breakTime} break seconds`);

      return dashboardData;
    } catch (error) {
      console.error('Error refreshing employee dashboard data:', error);
      throw error;
    }
  };

  // Function to refresh recent activity data
  const refreshRecentActivity = async () => {
    try {
      console.log('Fetching recent activity data...');

      // Call the recent activity API endpoint
      const response = await fetch('/api/activity/recent?limit=20', {
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

      const activityData = await response.json();
      console.log('Recent activity data fetched successfully');

      // Update recent activity state
      setRecentActivity(activityData.logs || []);

      return activityData;
    } catch (error) {
      console.error('Error refreshing recent activity data:', error);
      throw error;
    }
  };

  // Function to manually refresh data
  const handleManualRefresh = async () => {
    try {
      toast.info('Refreshing dashboard data...');
      console.log('Manual refresh initiated for employee dashboard');

      // Add a loading state
      const refreshButton = document.querySelector('[data-employee-refresh-button]');
      if (refreshButton) {
        refreshButton.setAttribute('disabled', 'true');
        refreshButton.innerHTML = '<svg class="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Refreshing...';
      }

      await refreshDashboardData();
      setLastUpdateTime(new Date());
      toast.success('Dashboard data refreshed successfully');

      // Reset the button
      if (refreshButton) {
        refreshButton.removeAttribute('disabled');
        refreshButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" /></svg> Refresh';
      }
    } catch (error) {
      console.error('Manual refresh error:', error);
      toast.error('Failed to refresh dashboard data. Please try again.');

      // Reset the button on error
      const refreshButton = document.querySelector('[data-employee-refresh-button]');
      if (refreshButton) {
        refreshButton.removeAttribute('disabled');
        refreshButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" /></svg> Retry';
      }
    }
  };

  // Helper function to format seconds into hours and minutes
  function formatSeconds(seconds: number): string {
    if (seconds === 0) return '0m';

    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }

  // Get adherence status badge color
  const getAdherenceBadgeColor = (status: string | null) => {
    switch (status) {
      case 'early': return 'bg-blue-500 hover:bg-blue-600';
      case 'on_time': return 'bg-green-500 hover:bg-green-600';
      case 'late': return 'bg-yellow-500 hover:bg-yellow-600';
      case 'absent': return 'bg-red-500 hover:bg-red-600';
      default: return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'signed_in': return 'bg-green-500 hover:bg-green-600';
      case 'on_break': return 'bg-blue-500 hover:bg-blue-600';
      case 'signed_out': return 'bg-gray-500 hover:bg-gray-600';
      default: return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  // Format adherence status for display
  const formatAdherenceStatus = (status: string | null) => {
    if (!status) return 'Not Set';

    switch (status) {
      case 'early': return 'Early';
      case 'on_time': return 'On Time';
      case 'late': return 'Late';
      case 'absent': return 'Absent';
      default: return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
    }
  };

  // Format status for display
  const formatStatus = (status: string) => {
    switch (status) {
      case 'signed_in': return 'Signed In';
      case 'on_break': return 'On Break';
      case 'signed_out': return 'Signed Out';
      default: return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Employee Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Your attendance and performance overview
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
                  {formatInTimeZone(lastUpdateTime, timezone, 'h:mm a')}
                </span>
              </>
            )}
          </div>
          <Button
            onClick={handleManualRefresh}
            className="inline-flex items-center px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors text-sm"
            disabled={!isClient}
            data-employee-refresh-button
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Current Status</CardTitle>
            <CardDescription>Your current attendance status</CardDescription>
          </CardHeader>
          <CardContent>
            {userStatus ? (
              <div className="flex items-center">
                <Badge className={`${getStatusBadgeColor(userStatus.status)} mr-2`}>
                  {formatStatus(userStatus.status)}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {userStatus.lastActivity} {userStatus.lastActivityTime && `at ${userStatus.lastActivityTime}`}
                </span>
              </div>
            ) : (
              <Skeleton className="h-8 w-full" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Adherence Status</CardTitle>
            <CardDescription>Your attendance adherence for today</CardDescription>
          </CardHeader>
          <CardContent>
            {userStatus ? (
              <div className="flex items-center">
                <Badge className={`${getAdherenceBadgeColor(userStatus.adherence)} mr-2`}>
                  {formatAdherenceStatus(userStatus.adherence)}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Department: {department?.name || 'Unassigned'}
                </span>
              </div>
            ) : (
              <Skeleton className="h-8 w-full" />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Today's Time</CardTitle>
            <CardDescription>Your active and break time today</CardDescription>
          </CardHeader>
          <CardContent>
            {userStatus ? (
              <div className="flex flex-col">
                <div className="flex items-center mb-1">
                  <span className="text-sm font-medium mr-2">Active:</span>
                  <span className="text-sm">{formatSeconds(activeTime)}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-sm font-medium mr-2">Break:</span>
                  <span className="text-sm">{formatSeconds(breakTime)}</span>
                </div>
              </div>
            ) : (
              <Skeleton className="h-12 w-full" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Weekly Activity Chart */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Weekly Activity</CardTitle>
          <CardDescription>Your active and break time for the last 7 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            {dailyStats.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={dailyStats.map(day => ({
                    ...day,
                    activeHours: day.activeTime / 3600, // Convert seconds to hours
                    breakHours: day.breakTime / 3600 // Convert seconds to hours
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="dayOfWeek" />
                  <YAxis label={{ value: 'Hours', angle: -90, position: 'insideLeft' }} />
                  <Tooltip
                    formatter={(value: number) => [
                      `${Math.floor(value)}h ${Math.floor((value % 1) * 60)}m`,
                      value === 0 ? 'No time' : value < 1 ? 'Minutes' : 'Hours'
                    ]}
                  />
                  <Legend />
                  <Bar dataKey="activeHours" name="Active Time" fill="#4f46e5" />
                  <Bar dataKey="breakHours" name="Break Time" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No activity data available for the past week</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your recent attendance events</CardDescription>
        </CardHeader>
        <CardContent>
          {recentLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Event</th>
                    <th className="text-left py-2 font-medium">Time</th>
                    <th className="text-left py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.map((log) => (
                    <tr key={log.id} className="border-b">
                      <td className="py-2">
                        {log.event_type === 'signin' ? 'Sign In' :
                         log.event_type === 'signout' ? 'Sign Out' :
                         log.event_type === 'break_start' ? 'Break Start' :
                         log.event_type === 'break_end' ? 'Break End' : log.event_type}
                      </td>
                      <td className="py-2">{formatInTimeZone(parseISO(log.timestamp), timezone, 'h:mm a')}</td>
                      <td className="py-2">{formatInTimeZone(parseISO(log.timestamp), timezone, 'MMM d, yyyy')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-4 text-center text-muted-foreground">
              No recent activity found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
