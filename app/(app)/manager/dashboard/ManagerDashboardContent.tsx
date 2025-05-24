'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useLoading } from '@/components/LoadingContext';
import AdherenceBadge from '@/components/AdherenceBadge';
import AbsentMarkingButton from '@/components/AbsentMarkingButton';
import ChangeStatusDropdown from '@/components/ChangeStatusDropdown';
import { BuildingOfficeIcon, DocumentTextIcon, UsersIcon } from '@heroicons/react/24/outline';

interface ManagerDashboardContentProps {
  initialData: {
    employeeStatuses: any[];
    employeesByDepartment: Record<string, any[]>;
    allEmployees: any[];
    activeEmployeeCount: number;
    todayLogsCount: number;
    departmentMap: Record<string, any>;
    recentLogs: any[];
    today: Date;
    timezone: string;
    userRole: string;
    userDepartmentId: string;
    userDepartmentName: string;
    userId: string;
  };
}

export default function ManagerDashboardContent({ initialData }: ManagerDashboardContentProps) {
  const { stopLoading } = useLoading();
  const [isClient, setIsClient] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

  // State for real-time data
  const [employeeStatusesState, setEmployeeStatusesState] = useState<any[]>([]);
  const [employeesByDepartmentState, setEmployeesByDepartmentState] = useState<Record<string, any[]>>({});
  const [allEmployeesState, setAllEmployeesState] = useState<any[]>([]);
  const [activeEmployeeCountState, setActiveEmployeeCountState] = useState(0);
  const [todayLogsCountState, setTodayLogsCountState] = useState(0);
  const [departmentMapState, setDepartmentMapState] = useState<Record<string, any>>({});
  const [recentLogsState, setRecentLogsState] = useState<any[]>([]);
  const [timezoneState, setTimezoneState] = useState('UTC');
  const [userRoleState, setUserRoleState] = useState<string>('manager');
  const [userDepartmentIdState, setUserDepartmentIdState] = useState<string>('');
  const [userDepartmentNameState, setUserDepartmentNameState] = useState<string>('');
  const [userIdState, setUserIdState] = useState<string>('');

  // Extract data from props with safety checks
  const {
    employeeStatuses = [],
    employeesByDepartment = {},
    allEmployees = [],
    activeEmployeeCount = 0,
    todayLogsCount = 0,
    departmentMap = {},
    recentLogs = [],
    today = new Date(),
    timezone = 'UTC',
    userRole = 'manager',
    userDepartmentId = '',
    userDepartmentName = 'My Department',
    userId = ''
  } = initialData || {};

  // Initialize state with initial data
  useEffect(() => {
    setEmployeeStatusesState(employeeStatuses);
    setEmployeesByDepartmentState(employeesByDepartment);
    setAllEmployeesState(allEmployees);
    setActiveEmployeeCountState(activeEmployeeCount);
    setTodayLogsCountState(todayLogsCount);
    setDepartmentMapState(departmentMap);
    setRecentLogsState(recentLogs);
    setTimezoneState(timezone);
    setUserRoleState(userRole);
    setUserDepartmentIdState(userDepartmentId);
    setUserDepartmentNameState(userDepartmentName);
    setUserIdState(userId);
    setIsClient(true);
    stopLoading();
  }, [
    employeeStatuses,
    employeesByDepartment,
    allEmployees,
    activeEmployeeCount,
    todayLogsCount,
    departmentMap,
    recentLogs,
    timezone,
    userRole,
    userDepartmentId,
    userDepartmentName,
    userId,
    stopLoading
  ]);

  // Set up real-time subscription
  useEffect(() => {
    if (!isClient || !isRealTimeEnabled) return;

    const supabase = createClient();
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    // Create a channel for real-time updates
    const channel = supabase.channel('manager-dashboard-changes');
    
    // Subscribe to attendance_logs table changes
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'attendance_logs',
      filter: `timestamp=gte.${todayStr}T00:00:00`
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
      filter: `date=eq.${todayStr}`
    }, async (payload) => {
      console.log('Real-time adherence update received:', payload);

      try {
        // Show a more specific toast for adherence changes
        if (payload.new && payload.old) {
          // Status changed
          if (payload.new.status !== payload.old.status) {
            const userId = payload.new.user_id;
            const employee = allEmployeesState.find(emp => emp.id === userId);
            const employeeName = employee ? employee.full_name : 'An employee';

            toast.info(`${employeeName}'s adherence status changed to ${payload.new.status}`);
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
          console.log('Performing scheduled dashboard refresh...');
          await refreshDashboardData();
          setLastUpdateTime(new Date());
          console.log('Scheduled refresh completed successfully');
        } catch (error) {
          console.error('Error in scheduled refresh:', error);
        }
      }
    }, 3 * 60 * 1000);

    // Cleanup function
    return () => {
      supabase.removeChannel(channel);
      clearInterval(intervalId);
      console.log('Cleaned up real-time subscription and interval');
    };
  }, [isClient, isRealTimeEnabled, allEmployeesState]);

  // Function to refresh dashboard data using the unified API endpoint
  const refreshDashboardData = async () => {
    try {
      console.log('Fetching dashboard data from unified API endpoint...');

      // Call the unified API endpoint
      const response = await fetch('/api/dashboard/data', {
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
      console.log('Dashboard data fetched successfully');

      // Update all state variables with the fresh data
      setEmployeeStatusesState(dashboardData.employeeStatuses || []);
      setEmployeesByDepartmentState(dashboardData.employeesByDepartment || {});
      setAllEmployeesState(dashboardData.allEmployees || []);
      setActiveEmployeeCountState(dashboardData.activeEmployeeCount || 0);
      setTodayLogsCountState(dashboardData.todayLogsCount || 0);
      setDepartmentMapState(dashboardData.departmentMap || {});
      setTimezoneState(dashboardData.timezone || 'UTC');

      // Update user role information
      if (dashboardData.userRole) {
        setUserRoleState(dashboardData.userRole);
      }
      if (dashboardData.userDepartmentId !== undefined) {
        setUserDepartmentIdState(dashboardData.userDepartmentId);
      }
      if (dashboardData.userDepartmentName) {
        setUserDepartmentNameState(dashboardData.userDepartmentName);
      }
      if (dashboardData.userId) {
        setUserIdState(dashboardData.userId);
      }

      // Fetch recent activity separately using the dedicated API
      await refreshRecentActivity();

      return dashboardData;
    } catch (error) {
      console.error('Error refreshing dashboard data:', error);
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
      
      // Update recent logs state
      setRecentLogsState(activityData.logs || []);
      
      return activityData;
    } catch (error) {
      console.error('Error refreshing recent activity data:', error);
      throw error;
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

  // Function to manually refresh data
  const handleManualRefresh = async () => {
    try {
      toast.info('Refreshing dashboard data...');
      console.log('Manual refresh initiated');
      
      // Add a loading state
      const refreshButton = document.querySelector('[data-refresh-button]');
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
      const refreshButton = document.querySelector('[data-refresh-button]');
      if (refreshButton) {
        refreshButton.removeAttribute('disabled');
        refreshButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" /></svg> Retry';
      }
    }
  };

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Manager Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {userDepartmentNameState} Overview
          </p>
        </div>
        <div className="flex items-center space-x-4 mt-4 md:mt-0">
          <div className="text-sm text-muted-foreground">
            <span>Timezone: </span>
            <span className="font-medium">{timezoneState}</span>
            {lastUpdateTime && (
              <>
                <span className="mx-2">•</span>
                <span>Last updated: </span>
                <span className="font-medium">
                  {formatInTimeZone(lastUpdateTime, timezoneState, 'h:mm a')}
                </span>
              </>
            )}
          </div>
          <Button
            onClick={handleManualRefresh}
            className="inline-flex items-center px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors text-sm"
            data-refresh-button
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            Refresh
          </Button>
        </div>
      </div>

      {/* Dashboard Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Team Status</CardTitle>
            <CardDescription>Current team attendance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Active Employees:</span>
                <span className="text-sm font-bold text-green-600">{activeEmployeeCountState}</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Total Employees:</span>
                <span className="text-sm">{employeeStatusesState.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Today's Activity:</span>
                <span className="text-sm">{todayLogsCountState} events</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Employee Status Table */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>
                Current status of your team members
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Employee</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Adherence</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Active Time</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Break Time</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Last Activity</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(isRealTimeEnabled ? employeeStatusesState : employeeStatuses).map((employee) => {
                  // Get department info
                  const deptId = employee.department_id || 'unassigned';
                  const deptInfo = isRealTimeEnabled ? departmentMapState[deptId] : departmentMap[deptId];
                  
                  return (
                    <tr key={employee.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{employee.name}</td>
                      <td className="px-4 py-3">
                        <Badge variant={
                          employee.status === 'signed_in' ? 'success' :
                          employee.status === 'on_break' ? 'warning' : 'outline'
                        }>
                          {employee.status === 'signed_in' ? 'Active' :
                           employee.status === 'on_break' ? 'On Break' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {employee.adherence ? (
                          <AdherenceBadge
                            status={employee.adherence}
                            shiftStartTime={deptInfo?.shift_start_time}
                          />
                        ) : (
                          <span className="text-muted-foreground text-sm">Not set</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className={employee.totalActiveTime > 0 ? "text-green-600 font-medium" : ""}>
                          {formatSeconds(employee.totalActiveTime || 0)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className={employee.totalBreakTime > 0 ? "text-amber-600 font-medium" : ""}>
                          {formatSeconds(employee.totalBreakTime || 0)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {employee.lastActivity} {employee.lastActivityTime ? `at ${employee.lastActivityTime}` : ''}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <Link href={`/manager/reports?employeeId=${employee.id}`}>
                            <Button variant="ghost" size="sm">View History</Button>
                          </Link>
                          <ChangeStatusDropdown
                            employeeId={employee.id}
                            employeeName={employee.name}
                            currentStatus={employee.status}
                            onStatusChanged={refreshDashboardData}
                          />
                          {employee.adherence === 'late' && employee.eligible_for_absent && (
                            <AbsentMarkingButton
                              userId={employee.id}
                              employeeName={employee.name}
                              date={format(today, 'yyyy-MM-dd')}
                              onSuccess={refreshDashboardData}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {(isRealTimeEnabled ? employeeStatusesState : employeeStatuses).length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No employees found in your department.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest attendance events from your team
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentLogsState && recentLogsState.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Employee</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Event</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Date</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLogsState.map(log => {
                      // Get employee name from the log
                      const employeeName = log.userName || 'Unknown Employee';
                      
                      // Format event type
                      let eventType = '';
                      let eventVariant: 'success' | 'destructive' | 'warning' | 'outline' = 'outline';

                      switch(log.eventType) {
                        case 'signin':
                          eventType = 'Signed In';
                          eventVariant = 'success';
                          break;
                        case 'signout':
                          eventType = 'Signed Out';
                          eventVariant = 'destructive';
                          break;
                        case 'break_start':
                          eventType = 'Started Break';
                          eventVariant = 'warning';
                          break;
                        case 'break_end':
                          eventType = 'Ended Break';
                          eventVariant = 'success';
                          break;
                        default:
                          eventType = log.eventType;
                      }

                      return (
                        <tr key={log.id} className="border-t border-border hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">{employeeName}</td>
                          <td className="px-4 py-3">
                            <Badge variant={eventVariant}>
                              {eventType}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{log.formattedDate}</td>
                          <td className="px-4 py-3 text-muted-foreground">{log.formattedTime}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No recent activity found. Activity will appear here when employees sign in or out.
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end border-t pt-4">
          <Link href="/manager/reports">
            <Button variant="outline" size="sm">
              View All Activity
            </Button>
          </Link>
        </CardFooter>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/manager/reports">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>View Reports</CardTitle>
                <CardDescription>
                  Access detailed attendance reports
                </CardDescription>
              </div>
              <DocumentTextIcon className="h-6 w-6 text-primary" />
            </CardHeader>
          </Card>
        </Link>
        <Link href="/manager/team">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Team Management</CardTitle>
                <CardDescription>
                  View and manage your team
                </CardDescription>
              </div>
              <UsersIcon className="h-6 w-6 text-primary" />
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
