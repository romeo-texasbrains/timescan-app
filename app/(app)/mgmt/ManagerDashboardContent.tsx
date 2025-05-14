'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ChartBarIcon, DocumentTextIcon, UsersIcon, ClockIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';
import { format, parseISO, isSameDay } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/types/profile';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useLoading } from '@/context/LoadingContext';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import ChangeStatusDropdown from '@/components/ChangeStatusDropdown';
import { determineUserStatus, getLastActivity, getStatusLabel, eventTypeToStatus } from '@/lib/utils/statusDetermination';
import AdherenceBadge from '@/components/AdherenceBadge';
import AbsentMarkingButton from '@/components/AbsentMarkingButton';

// Type for employee status
type EmployeeStatus = {
  id: string;
  name: string;
  status: 'signed_in' | 'signed_out' | 'on_break';
  lastActivity: string;
  lastActivityTime: string;
  totalActiveTime?: number; // Total active time in seconds
  totalBreakTime?: number; // Total break time in seconds
  adherence?: 'early' | 'on_time' | 'late' | 'absent' | null;
  eligible_for_absent?: boolean;
};

interface ManagerDashboardContentProps {
  initialData: {
    employeeStatuses: EmployeeStatus[];
    employeesInDepartment: any[];
    activeEmployeeCount: number;
    todayLogsCount: number;
    departmentMap: Map<string, string>;
    managerProfile: any;
    recentLogs: any[];
    today: Date;
    timezone: string;
  };
}

const ManagerDashboardContent: React.FC<ManagerDashboardContentProps> = ({ initialData }) => {
  const { stopLoading } = useLoading();
  const [isClient, setIsClient] = useState(false);
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);

  // State for real-time data
  const [employeeStatusesState, setEmployeeStatusesState] = useState<EmployeeStatus[]>([]);
  const [employeesInDepartmentState, setEmployeesInDepartmentState] = useState<any[]>([]);
  const [activeEmployeeCountState, setActiveEmployeeCountState] = useState(0);
  const [todayLogsCountState, setTodayLogsCountState] = useState(0);
  const [departmentMapState, setDepartmentMapState] = useState<Record<string, string>>({});
  const [managerProfileState, setManagerProfileState] = useState<any>(null);
  const [recentLogsState, setRecentLogsState] = useState<any[]>([]);
  const [timezoneState, setTimezoneState] = useState('UTC');

  // Extract data from props with safety checks
  const {
    employeeStatuses = [],
    employeesInDepartment = [],
    activeEmployeeCount = 0,
    todayLogsCount = 0,
    departmentMap = {},
    managerProfile = null,
    recentLogs = [],
    today = new Date(),
    timezone = 'UTC'
  } = initialData || {};

  // Initialize state with initial data
  useEffect(() => {
    setEmployeeStatusesState(employeeStatuses);
    setEmployeesInDepartmentState(employeesInDepartment);
    setActiveEmployeeCountState(activeEmployeeCount);
    setTodayLogsCountState(todayLogsCount);
    setDepartmentMapState(convertMapToObject(departmentMap));
    setManagerProfileState(managerProfile);
    setRecentLogsState(recentLogs);
    setTimezoneState(timezone);
    setIsClient(true);
    stopLoading();
  }, [
    employeeStatuses,
    employeesInDepartment,
    activeEmployeeCount,
    todayLogsCount,
    departmentMap,
    managerProfile,
    recentLogs,
    timezone,
    stopLoading
  ]);

  // Helper function to convert Map to object
  const convertMapToObject = (map: Map<string, string> | Record<string, string>): Record<string, string> => {
    if (map instanceof Map) {
      const obj: Record<string, string> = {};
      map.forEach((value, key) => {
        obj[key] = value;
      });
      return obj;
    }
    return map as Record<string, string>;
  };

  // Set up real-time subscription
  useEffect(() => {
    if (!isClient || !isRealTimeEnabled) return;

    const supabase = createClient();
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    // Subscribe to all attendance_logs table changes
    const subscription = supabase
      .channel('manager-dashboard-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'attendance_logs'
        // No date filter to catch all changes
      }, async (payload) => {
        console.log('Real-time update received:', payload);

        try {
          // Fetch updated data
          await refreshDashboardData();
          setLastUpdateTime(new Date());
        } catch (error) {
          console.error('Error refreshing dashboard data:', error);
          toast.error('Failed to update dashboard data');
        }
      })
      .subscribe();

    // Refresh data every 2 minutes as a fallback
    const intervalId = setInterval(async () => {
      if (isRealTimeEnabled) {
        try {
          await refreshDashboardData();
          setLastUpdateTime(new Date());
        } catch (error) {
          console.error('Error in scheduled refresh:', error);
        }
      }
    }, 2 * 60 * 1000);

    // Cleanup function
    return () => {
      supabase.removeChannel(subscription);
      clearInterval(intervalId);
    };
  }, [isClient, isRealTimeEnabled]);

  // Function to refresh dashboard data
  const refreshDashboardData = async () => {
    try {
      const supabase = createClient();
      const todayStr = format(new Date(), 'yyyy-MM-dd');

      // Fetch today's logs count
      const { count: newTodayLogsCount } = await supabase
        .from('attendance_logs')
        .select('*', { count: 'exact', head: true })
        .gte('timestamp', `${todayStr}T00:00:00`)
        .lte('timestamp', `${todayStr}T23:59:59`);

      if (newTodayLogsCount !== null) {
        setTodayLogsCountState(newTodayLogsCount);
      }

      // Get team member IDs
      const teamMemberIds = employeesInDepartmentState.map(emp => emp.id);

      // Fetch recent logs
      if (teamMemberIds.length > 0) {
        const { data: newRecentLogs } = await supabase
          .from('attendance_logs')
          .select('id, user_id, event_type, timestamp')
          .in('user_id', teamMemberIds)
          .order('timestamp', { ascending: false })
          .limit(20);

        if (newRecentLogs) {
          setRecentLogsState(newRecentLogs);
        }
      }

      // Fetch team metrics from the API
      const departmentId = managerProfileState?.department_id || '';
      const response = await fetch(`/api/attendance/team-metrics?departmentId=${departmentId}&timezone=${encodeURIComponent(timezoneState)}`);

      if (!response.ok) {
        console.error(`Failed to fetch team metrics: ${response.status} ${response.statusText}`);
        throw new Error(`Failed to fetch team metrics: ${response.statusText}`);
      }

      const { employees } = await response.json();

      if (employees && employees.length > 0) {
        // Convert API metrics to employee statuses using our utility functions
        const newEmployeeStatuses: EmployeeStatus[] = employees.map(employee => {
          // Get the status directly from the API
          const status = employee.isOnBreak ? 'on_break' : employee.isActive ? 'signed_in' : 'signed_out';

          // Get the last activity status using our utility function
          const lastActivityStatus = employee.lastActivity ?
            eventTypeToStatus(employee.lastActivity.type) : 'signed_out';

          return {
            id: employee.userId,
            name: employee.fullName || 'Unnamed',
            status: status,
            lastActivity: employee.lastActivity ?
              getStatusLabel(lastActivityStatus) : 'No activity recorded',
            lastActivityTime: employee.lastActivity ?
              formatInTimeZone(parseISO(employee.lastActivity.timestamp), timezoneState, 'h:mm a') : '',
            totalActiveTime: employee.workTime, // Keep as seconds to match client-side
            totalBreakTime: employee.breakTime  // Keep as seconds to match client-side
          };
        });

        // Sort employee statuses with robust error handling
        try {
          newEmployeeStatuses.sort((a, b) => {
            try {
              // Active employees first
              if (a.status !== 'signed_out' && b.status === 'signed_out') return -1;
              if (a.status === 'signed_out' && b.status !== 'signed_out') return 1;

              // Then sort by name - with defensive programming
              // Ensure both names are strings
              const nameA = typeof a.name === 'string' ? a.name : String(a.name || a.id || '');
              const nameB = typeof b.name === 'string' ? b.name : String(b.name || b.id || '');

              // Use simple string comparison instead of localeCompare
              return nameA > nameB ? 1 : nameA < nameB ? -1 : 0;
            } catch (innerError) {
              console.error('Error comparing employees:', innerError, { a, b });
              return 0; // Keep original order if comparison fails
            }
          });
        } catch (sortError) {
          console.error('Error sorting employees:', sortError);
          // If sorting fails, at least we still have the unsorted array
        }

        // Update state
        setEmployeeStatusesState(newEmployeeStatuses);
        setActiveEmployeeCountState(newEmployeeStatuses.filter(emp => emp.status !== 'signed_out').length);
      }
    } catch (error) {
      console.error('Error refreshing dashboard data:', error);
      throw error;
    }
  };

  // Function to manually refresh data
  const handleManualRefresh = async () => {
    try {
      await refreshDashboardData();
      setLastUpdateTime(new Date());
      toast.success('Dashboard data refreshed');
    } catch (error) {
      toast.error('Failed to refresh dashboard data');
    }
  };

  // Toggle real-time updates
  const toggleRealTimeUpdates = () => {
    setIsRealTimeEnabled(prev => !prev);
    toast.info(isRealTimeEnabled ? 'Real-time updates disabled' : 'Real-time updates enabled');
  };

  // We're now using the imported getStatusLabel function from our utility

  // Helper function to format seconds into hours and minutes
  function formatSeconds(seconds: number | undefined): string {
    if (!seconds) return '0m';

    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }

  if (!isClient) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Manager Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Overview of your team's attendance status
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/mgmt/profiles">
              <Button variant="outline" className="bg-card hover:bg-primary/10 border-primary/30 text-primary transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                Team Profiles
              </Button>
            </Link>
            <div className="flex flex-col items-end gap-2">
              <div className="text-sm text-muted-foreground">
                {formatInTimeZone(today, isRealTimeEnabled ? timezoneState : timezone, 'EEEE, MMMM d, yyyy')}
                <span className="ml-2 text-xs text-primary">({(isRealTimeEnabled ? timezoneState : timezone).replace(/_/g, ' ')})</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleManualRefresh}
                  className="inline-flex items-center px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors text-sm"
                  disabled={!isClient}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                  Refresh
                </button>
                <button
                  onClick={toggleRealTimeUpdates}
                  className={`inline-flex items-center px-3 py-1.5 rounded-lg transition-colors text-sm ${
                    isRealTimeEnabled
                      ? 'bg-green-500/10 hover:bg-green-500/20 text-green-600'
                      : 'bg-red-500/10 hover:bg-red-500/20 text-red-600'
                  }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                  {isRealTimeEnabled ? 'Real-time: On' : 'Real-time: Off'}
                </button>
              </div>
              {lastUpdateTime && (
                <div className="text-xs text-muted-foreground">
                  Last updated: {formatInTimeZone(lastUpdateTime, isRealTimeEnabled ? timezoneState : timezone, 'h:mm:ss a')}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Manager's Department Banner */}
        {(isRealTimeEnabled ? managerProfileState : managerProfile)?.department_id && (
          <div className="mt-2 flex items-center">
            <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg flex items-center">
              <BuildingOfficeIcon className="h-5 w-5 mr-2" />
              <span className="font-medium">
                Department: {(() => {
                  try {
                    const deptId = isRealTimeEnabled
                      ? managerProfileState?.department_id
                      : managerProfile?.department_id;

                    if (!deptId) return 'Unknown';

                    if (isRealTimeEnabled) {
                      // Handle real-time state (object)
                      const deptInfo = departmentMapState[deptId];
                      if (typeof deptInfo === 'string') {
                        return deptInfo;
                      } else if (typeof deptInfo === 'object' && deptInfo !== null && 'name' in deptInfo) {
                        return String(deptInfo.name);
                      }
                    } else {
                      // Handle initial data (Map)
                      if (departmentMap instanceof Map) {
                        const deptName = departmentMap.get(deptId);
                        if (deptName) {
                          return String(deptName);
                        }
                      } else if (typeof departmentMap === 'object' && departmentMap !== null) {
                        // Handle if it's an object instead of a Map
                        const deptInfo = departmentMap[deptId];
                        if (typeof deptInfo === 'string') {
                          return deptInfo;
                        } else if (typeof deptInfo === 'object' && deptInfo !== null && 'name' in deptInfo) {
                          return String(deptInfo.name);
                        }
                      }
                    }

                    return 'Unknown';
                  } catch (error) {
                    console.error('Error getting department name for banner:', error);
                    return 'Unknown';
                  }
                })()}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <UsersIcon className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{isRealTimeEnabled ? employeesInDepartmentState.length : employeesInDepartment.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              In your department
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Today</CardTitle>
            <UsersIcon className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{isRealTimeEnabled ? activeEmployeeCountState : activeEmployeeCount || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Employees who signed in today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today's Activity</CardTitle>
            <DocumentTextIcon className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{isRealTimeEnabled ? todayLogsCountState : todayLogsCount || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total attendance logs today
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Employee Status Card */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>My Team</CardTitle>
              <CardDescription>
                {(isRealTimeEnabled ? managerProfileState : managerProfile)?.department_id
                  ? (() => {
                      try {
                        const deptId = isRealTimeEnabled
                          ? managerProfileState?.department_id
                          : managerProfile?.department_id;

                        if (!deptId) return 'Your Department';

                        let deptName = 'Your';

                        if (isRealTimeEnabled) {
                          // Handle real-time state (object)
                          const deptInfo = departmentMapState[deptId];
                          if (typeof deptInfo === 'string') {
                            deptName = deptInfo;
                          } else if (typeof deptInfo === 'object' && deptInfo !== null && 'name' in deptInfo) {
                            deptName = String(deptInfo.name);
                          }
                        } else {
                          // Handle initial data (Map)
                          if (departmentMap instanceof Map) {
                            const name = departmentMap.get(deptId);
                            if (name) {
                              deptName = String(name);
                            }
                          } else if (typeof departmentMap === 'object' && departmentMap !== null) {
                            // Handle if it's an object instead of a Map
                            const deptInfo = departmentMap[deptId];
                            if (typeof deptInfo === 'string') {
                              deptName = deptInfo;
                            } else if (typeof deptInfo === 'object' && deptInfo !== null && 'name' in deptInfo) {
                              deptName = String(deptInfo.name);
                            }
                          }
                        }

                        return `${deptName} Department`;
                      } catch (error) {
                        console.error('Error getting department name for card description:', error);
                        return 'Your Department';
                      }
                    })()
                  : 'All Employees'}
              </CardDescription>
            </div>
            <Badge variant="outline" className="ml-2">
              {formatInTimeZone(today, isRealTimeEnabled ? timezoneState : timezone, 'MMM d, yyyy')}
            </Badge>
          </div>
          {(isRealTimeEnabled ? employeesInDepartmentState : employeesInDepartment).length === 0 && (
            <div className="mt-4 p-4 bg-blue-50 text-blue-700 rounded-md">
              <p className="text-sm font-medium">No team members found</p>
              <p className="text-xs mt-1">
                There are currently no employees assigned to your department. Please contact an administrator to add team members.
              </p>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {/* Team Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-muted/20 rounded-lg p-4">
              <div className="text-sm text-muted-foreground">Total Team Members</div>
              <div className="text-2xl font-bold mt-1">
                {(isRealTimeEnabled ? employeeStatusesState : employeeStatuses).length}
              </div>
            </div>
            <div className="bg-green-500/10 rounded-lg p-4">
              <div className="text-sm text-muted-foreground">Currently Active</div>
              <div className="text-2xl font-bold mt-1 text-green-600">
                {(isRealTimeEnabled ? employeeStatusesState : employeeStatuses).filter(emp => emp.status === 'signed_in').length}
              </div>
            </div>
            <div className="bg-amber-500/10 rounded-lg p-4">
              <div className="text-sm text-muted-foreground">On Break</div>
              <div className="text-2xl font-bold mt-1 text-amber-600">
                {(isRealTimeEnabled ? employeeStatusesState : employeeStatuses).filter(emp => emp.status === 'on_break').length}
              </div>
            </div>
            <div className="bg-red-500/10 rounded-lg p-4">
              <div className="text-sm text-muted-foreground">Not Signed In</div>
              <div className="text-2xl font-bold mt-1 text-red-600">
                {(isRealTimeEnabled ? employeeStatusesState : employeeStatuses).filter(emp => emp.status === 'signed_out').length}
              </div>
            </div>
          </div>

          {/* Team Members Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Team Member</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Department</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Adherence</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Active Time</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Break Time</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Last Activity</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Time</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(isRealTimeEnabled ? employeeStatusesState : employeeStatuses).map((employee) => {
                  // Find the employee in the original data to get department
                  const employeeData = (isRealTimeEnabled ? employeesInDepartmentState : employeesInDepartment)
                    .find(emp => emp && emp.id === employee.id);
                  // Get department info with proper type checking
                  let departmentName = 'Unknown';
                  let shiftStartTime = null;

                  try {
                    if (employeeData && employeeData.department_id) {
                      const deptId = employeeData.department_id;

                      if (isRealTimeEnabled) {
                        // Handle real-time state (object)
                        const deptInfo = departmentMapState[deptId];
                        if (typeof deptInfo === 'string') {
                          departmentName = deptInfo;
                        } else if (typeof deptInfo === 'object' && deptInfo !== null && 'name' in deptInfo) {
                          departmentName = String(deptInfo.name);
                          if ('shift_start_time' in deptInfo) {
                            shiftStartTime = deptInfo.shift_start_time;
                          }
                        }
                      } else {
                        // Handle initial data (Map)
                        if (departmentMap instanceof Map) {
                          const deptName = departmentMap.get(deptId);
                          if (deptName) {
                            departmentName = String(deptName);
                          }
                        } else if (typeof departmentMap === 'object' && departmentMap !== null) {
                          // Handle if it's an object instead of a Map
                          const deptInfo = departmentMap[deptId];
                          if (typeof deptInfo === 'string') {
                            departmentName = deptInfo;
                          } else if (typeof deptInfo === 'object' && deptInfo !== null && 'name' in deptInfo) {
                            departmentName = String(deptInfo.name);
                            if ('shift_start_time' in deptInfo) {
                              shiftStartTime = deptInfo.shift_start_time;
                            }
                          }
                        }
                      }
                    } else {
                      departmentName = 'None';
                    }
                  } catch (error) {
                    console.error('Error getting department info:', error);
                    departmentName = 'Unknown';
                  }

                  // shiftStartTime is already set in the code above

                  return (
                    <tr key={employee.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="flex items-center">
                          {/* Find the full employee data to get profile picture */}
                          {(() => {
                            const employeeData = (isRealTimeEnabled ? employeesInDepartmentState : employeesInDepartment)
                              .find(emp => emp && emp.id === employee.id);

                            return (
                              <Avatar className="h-8 w-8 mr-3 border border-primary/20">
                                {employeeData && employeeData.profile_picture_url ? (
                                  <AvatarImage src={employeeData.profile_picture_url} alt={employee.name || ''} />
                                ) : (
                                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                    {employee.name ? getInitials(employee.name) : '?'}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                            );
                          })()}
                          <Link href={`/mgmt/profiles/${employee.id}`} className="font-medium hover:text-primary hover:underline transition-colors">
                            {employee.name}
                          </Link>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{departmentName}</td>
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
                            shiftStartTime={shiftStartTime}
                          />
                        ) : (
                          <span className="text-muted-foreground text-sm">Not set</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className={employee.totalActiveTime > 0 ? "text-green-600 font-medium" : ""}>
                          {formatSeconds(employee.totalActiveTime)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <span className={employee.totalBreakTime > 0 ? "text-amber-600 font-medium" : ""}>
                          {formatSeconds(employee.totalBreakTime)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{employee.lastActivity}</td>
                      <td className="px-4 py-3 text-muted-foreground">{employee.lastActivityTime}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          <Link href={`/mgmt/reports?employeeId=${employee.id}`}>
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
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      No team members found in your department. Please contact an administrator to add team members.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end border-t pt-4">
          <Link href="/mgmt/reports">
            <Button size="sm">
              View Detailed Reports
            </Button>
          </Link>
        </CardFooter>
      </Card>

      {/* Recent Activity */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Recent Team Activity</CardTitle>
              <CardDescription>
                Latest attendance events from your team members
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(isRealTimeEnabled ? recentLogsState : recentLogs) && (isRealTimeEnabled ? recentLogsState : recentLogs).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Team Member</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Event</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Date</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(isRealTimeEnabled ? recentLogsState : recentLogs).map(log => {
                      // Find employee name
                      const employee = (isRealTimeEnabled ? employeesInDepartmentState : employeesInDepartment)
                        .find(emp => emp && emp.id === log.user_id);
                      const employeeName = employee && employee.full_name ? employee.full_name : 'Unknown Employee';

                      // Format event type
                      let eventType = '';
                      let eventVariant: 'success' | 'destructive' | 'warning' | 'outline' = 'outline';

                      switch(log.event_type) {
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
                          eventType = log.event_type;
                      }

                      // Format timestamp with timezone handling
                      const timestamp = parseISO(log.timestamp);
                      const currentTimezone = isRealTimeEnabled ? timezoneState : timezone;
                      const dateStr = formatInTimeZone(timestamp, currentTimezone, 'MMM d, yyyy');
                      const timeStr = formatInTimeZone(timestamp, currentTimezone, 'h:mm a');

                      return (
                        <tr key={log.id} className="border-t border-border hover:bg-muted/20">
                          <td className="px-4 py-3">
                            <div className="flex items-center">
                              <Avatar className="h-8 w-8 mr-3 border border-primary/20">
                                {employee && employee.profile_picture_url ? (
                                  <AvatarImage src={employee.profile_picture_url} alt={employeeName || ''} />
                                ) : (
                                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                    {employeeName ? getInitials(employeeName) : '?'}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <Link href={`/mgmt/profiles/${log.user_id}`} className="font-medium hover:text-primary hover:underline transition-colors">
                                {employeeName}
                              </Link>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={eventVariant}>
                              {eventType}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{dateStr}</td>
                          <td className="px-4 py-3 text-muted-foreground">{timeStr}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No recent activity found. Activity will appear here when team members sign in or out.
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end border-t pt-4">
          <Link href="/mgmt/reports">
            <Button variant="outline" size="sm">
              View All Activity
            </Button>
          </Link>
        </CardFooter>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-1 gap-6">
        <Link href="/mgmt/reports">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>View Reports</CardTitle>
                <CardDescription>
                  Access detailed attendance reports for your team
                </CardDescription>
              </div>
              <DocumentTextIcon className="h-6 w-6 text-primary" />
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
};

export default ManagerDashboardContent;
