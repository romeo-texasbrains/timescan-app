'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ChartBarIcon, DocumentTextIcon, UsersIcon, ClockIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';
import { format, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { capShiftDuration, MAX_SHIFT_DURATION_SECONDS } from '@/lib/shift-utils';
import AdherenceBadge from '@/components/AdherenceBadge';
import AbsentMarkingButton from '@/components/AbsentMarkingButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useLoading } from '@/context/LoadingContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import ChangeStatusDropdown from '@/components/ChangeStatusDropdown';
import { determineUserStatus, getLastActivity, getStatusLabel, eventTypeToStatus } from '@/lib/utils/statusDetermination';

// Type for employee status
type EmployeeStatus = {
  id: string;
  name: string;
  status: 'signed_in' | 'signed_out' | 'on_break';
  lastActivity: string;
  lastActivityTime: string;
  department_id: string;
  totalActiveTime?: number;
  totalBreakTime?: number;
  adherence?: 'early' | 'on_time' | 'late' | 'absent' | null;
  eligible_for_absent?: boolean;
};

interface AdminDashboardContentProps {
  initialData: {
    employeeStatuses: EmployeeStatus[];
    employeesByDepartment: Map<string, EmployeeStatus[]>;
    allEmployees: any[];
    activeEmployeeCount: number;
    todayLogsCount: number;
    departmentMap: Map<string, string>;
    recentLogs: any[];
    today: Date;
    timezone: string;
    userRole?: 'admin' | 'manager';
    userDepartmentId?: string;
    userDepartmentName?: string;
    userId?: string;
  };
}

const AdminDashboardContent: React.FC<AdminDashboardContentProps> = ({ initialData }) => {
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
  const [departmentMapState, setDepartmentMapState] = useState<Record<string, string>>({});
  const [recentLogsState, setRecentLogsState] = useState<any[]>([]);
  const [timezoneState, setTimezoneState] = useState('UTC');
  const [userRoleState, setUserRoleState] = useState<'admin' | 'manager' | undefined>(undefined);
  const [userDepartmentIdState, setUserDepartmentIdState] = useState<string | undefined>(undefined);
  const [userDepartmentNameState, setUserDepartmentNameState] = useState<string | undefined>(undefined);
  const [userIdState, setUserIdState] = useState<string | undefined>(undefined);

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
    userRole = 'admin',
    userDepartmentId = '',
    userDepartmentName = 'All Departments',
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
    setUserRoleState(userRole as 'admin' | 'manager');
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
    const channel = supabase.channel('admin-dashboard-changes');

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

    // Also subscribe to profiles table changes to catch new employees or department changes
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'profiles'
    }, async (payload) => {
      console.log('Real-time profile update received:', payload);

      try {
        // Fetch updated data
        await refreshDashboardData();
        setLastUpdateTime(new Date());
        toast.info('Employee data updated');
      } catch (error) {
        console.error('Error refreshing dashboard data after profile change:', error);
        toast.error('Failed to update employee data');
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
  }, [isClient, isRealTimeEnabled]);

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
        setUserRoleState(dashboardData.userRole as 'admin' | 'manager');
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

      // Log some debug information
      console.log(`Refreshed dashboard data: ${dashboardData.employeeStatuses?.length || 0} employees, ${dashboardData.todayLogsCount || 0} logs today`);

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

    // Log the input for debugging
    console.log('Formatting seconds:', seconds);

    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  }

  // Add detailed debugging for department map
  console.log('AdminDashboardContent: Initial departmentMap type:', typeof departmentMap);
  console.log('AdminDashboardContent: Initial departmentMapState type:', typeof departmentMapState);

  // Log the actual department map content
  if (departmentMap && typeof departmentMap === 'object') {
    console.log('AdminDashboardContent: departmentMap entries:');
    Object.entries(departmentMap).forEach(([id, dept]) => {
      console.log(`Department ID: ${id}, Type: ${typeof dept}, Value:`, dept);

      if (typeof dept === 'object' && dept !== null) {
        console.log(`  - name: ${dept.name} (type: ${typeof dept.name})`);
        if (dept.name === undefined || dept.name === null) {
          console.warn(`  - WARNING: Department ${id} has null/undefined name!`);
        }
      }
    });
  }

  // Convert object to array for rendering - ensure it's client-side only
  const departmentsArray = isClient ? (() => {
    try {
      // Get the appropriate data source
      const employeesByDept = isRealTimeEnabled ? employeesByDepartmentState : employeesByDepartment;
      const deptMap = isRealTimeEnabled ? departmentMapState : departmentMap;

      console.log('Creating departmentsArray with:',
        'isRealTimeEnabled=', isRealTimeEnabled,
        'deptMap type=', typeof deptMap);

      if (!employeesByDept || typeof employeesByDept !== 'object') {
        console.error('Invalid employeesByDepartment data:', employeesByDept);
        return []; // Return empty array if data is invalid
      }

      // Create department array with robust error handling
      const result = Object.entries(employeesByDept).map(([id, employees]) => {
        // Default department name
        let departmentName = id === 'unassigned' ? 'Unassigned' : `Department ${id}`;
        let shiftStartTime = null;
        let shiftEndTime = null;
        let gracePeriodMinutes = 30;

        try {
          // Get department info if available
          if (deptMap && typeof deptMap === 'object') {
            const deptInfo = deptMap[id];

            if (deptInfo) {
              // Handle string department names
              if (typeof deptInfo === 'string') {
                departmentName = deptInfo;
              }
              // Handle object department info
              else if (typeof deptInfo === 'object' && deptInfo !== null) {
                // Extract name with validation
                if ('name' in deptInfo && deptInfo.name !== null && deptInfo.name !== undefined) {
                  departmentName = String(deptInfo.name);
                }

                // Extract other properties
                if ('shift_start_time' in deptInfo) shiftStartTime = deptInfo.shift_start_time;
                if ('shift_end_time' in deptInfo) shiftEndTime = deptInfo.shift_end_time;
                if ('grace_period_minutes' in deptInfo &&
                    typeof deptInfo.grace_period_minutes === 'number') {
                  gracePeriodMinutes = deptInfo.grace_period_minutes;
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error processing department ${id}:`, error);
          // Use default values set above
        }

        // ULTRA-SIMPLE: Create department object with minimal processing
        // Just use the ID as the name if all else fails
        const deptObj = {
          id,
          name: String(id), // Default to ID as string
          shift_start_time: null,
          shift_end_time: null,
          grace_period_minutes: 30,
          employees: Array.isArray(employees) ? employees : [] // Ensure employees is always an array
        };

        // Try to set a better name if available
        if (id === 'unassigned') {
          deptObj.name = 'Unassigned';
        } else if (typeof departmentName === 'string' && departmentName.trim() !== '') {
          deptObj.name = departmentName;
        } else {
          deptObj.name = `Department ${id}`;
        }

        // Set other properties if available
        if (shiftStartTime !== null) deptObj.shift_start_time = shiftStartTime;
        if (shiftEndTime !== null) deptObj.shift_end_time = shiftEndTime;
        if (typeof gracePeriodMinutes === 'number') deptObj.grace_period_minutes = gracePeriodMinutes;

        return deptObj;
      });

      // Log the final array for debugging
      console.log(`Created departmentsArray with ${result.length} departments`);
      if (result.length > 0) {
        console.log('First few departments:', result.slice(0, 3).map(d => ({ id: d.id, name: d.name, name_type: typeof d.name })));
      }

      return result;
    } catch (error) {
      console.error('Error creating departments array:', error);
      return []; // Return empty array on error
    }
  })() : [];

  // NO SORTING AT ALL - COMPLETELY REMOVED
  // Just ensure all departments have valid string names
  if (Array.isArray(departmentsArray)) {
    for (let i = 0; i < departmentsArray.length; i++) {
      if (departmentsArray[i]) {
        // Force name to be a string
        departmentsArray[i].name = String(departmentsArray[i].name || departmentsArray[i].id || 'Unknown Department');
      }
    }

    // Move 'unassigned' to the end if it exists
    const unassignedIndex = departmentsArray.findIndex(dept => dept && dept.id === 'unassigned');
    if (unassignedIndex !== -1 && unassignedIndex < departmentsArray.length - 1) {
      const unassigned = departmentsArray.splice(unassignedIndex, 1)[0];
      departmentsArray.push(unassigned);
    }
  }

  // Log departments array for debugging
  if (isClient && departmentsArray.length > 0) {
    console.log('Departments array created successfully with', departmentsArray.length, 'departments');
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

      const dashboardData = await refreshDashboardData();
      setLastUpdateTime(new Date());

      // Debug: Log the total active time after refresh
      console.log('Client-side total active time after refresh:',
        employeeStatusesState.reduce((total, emp) => total + (emp.totalActiveTime || 0), 0));

      // Count adherence statuses for debugging
      const adherenceCounts = {
        early: 0,
        on_time: 0,
        late: 0,
        absent: 0,
        not_set: 0,
        null: 0
      };

      employeeStatusesState.forEach(emp => {
        if (emp.adherence === null) {
          adherenceCounts.null++;
        } else if (emp.adherence in adherenceCounts) {
          adherenceCounts[emp.adherence]++;
        } else {
          adherenceCounts.not_set++;
        }
      });

      console.log('Adherence status counts after refresh:', adherenceCounts);
      console.log('Employees eligible for absent marking:',
        employeeStatusesState.filter(emp => emp.eligible_for_absent).length);

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

  // Toggle real-time updates
  const toggleRealTimeUpdates = () => {
    setIsRealTimeEnabled(prev => !prev);
    toast.info(isRealTimeEnabled ? 'Real-time updates disabled' : 'Real-time updates enabled');
  };

  if (!isClient) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {isRealTimeEnabled ?
                (userRoleState === 'admin' ? 'Admin Dashboard' : 'Manager Dashboard') :
                (userRole === 'admin' ? 'Admin Dashboard' : 'Manager Dashboard')
              }
            </h1>
            <p className="text-muted-foreground mt-1">
              {isRealTimeEnabled ?
                (userRoleState === 'admin' ?
                  'Overview of all departments and employee attendance status' :
                  `Overview of ${userDepartmentNameState || 'your department'} attendance status`) :
                (userRole === 'admin' ?
                  'Overview of all departments and employee attendance status' :
                  `Overview of ${userDepartmentName || 'your department'} attendance status`)
              }
            </p>
          </div>
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
                data-refresh-button
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

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
            <UsersIcon className="h-5 w-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{isRealTimeEnabled ? allEmployeesState.length : allEmployees.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all departments
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
            <CardTitle className="text-sm font-medium">Departments</CardTitle>
            <BuildingOfficeIcon className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{isRealTimeEnabled ? Object.keys(departmentMapState).length : Object.keys(departmentMap).length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total departments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today's Activity</CardTitle>
            <DocumentTextIcon className="h-5 w-5 text-purple-500" />
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
              <CardTitle>All Teams</CardTitle>
              <CardDescription>
                Employee attendance status by department
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/admin/fix-adherence" className="text-xs text-blue-600 hover:underline">
                Fix Adherence Issues
              </Link>
              <Badge variant="outline">
                {format(today, 'MMM d, yyyy')}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Team Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-muted/20 rounded-lg p-4">
              <div className="text-sm text-muted-foreground">Total Employees</div>
              <div className="text-2xl font-bold mt-1">{employeeStatuses.length}</div>
            </div>
            <div className="bg-green-500/10 rounded-lg p-4">
              <div className="text-sm text-muted-foreground">Currently Active</div>
              <div className="text-2xl font-bold mt-1 text-green-600">
                {employeeStatuses.filter(emp => emp.status === 'signed_in').length}
              </div>
            </div>
            <div className="bg-amber-500/10 rounded-lg p-4">
              <div className="text-sm text-muted-foreground">On Break</div>
              <div className="text-2xl font-bold mt-1 text-amber-600">
                {employeeStatuses.filter(emp => emp.status === 'on_break').length}
              </div>
            </div>
            <div className="bg-red-500/10 rounded-lg p-4">
              <div className="text-sm text-muted-foreground">Not Signed In</div>
              <div className="text-2xl font-bold mt-1 text-red-600">
                {employeeStatuses.filter(emp => emp.status === 'signed_out').length}
              </div>
            </div>
          </div>

          {/* Department Tabs */}
          <Tabs defaultValue="all" className="w-full" onValueChange={setActiveTab}>
            <div className="overflow-x-auto pb-2">
              <TabsList className="mb-4 flex flex-nowrap min-w-max">
                <TabsTrigger value="all" className="whitespace-nowrap">All Departments</TabsTrigger>
                {departmentsArray.map(dept => (
                  <TabsTrigger key={dept.id} value={dept.id} className="whitespace-nowrap">
                    {dept.name} ({dept.employees.length})
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <TabsContent value="all">
              {/* Summary for all employees */}
              {(isRealTimeEnabled ? employeeStatusesState : employeeStatuses).length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-green-500/10 rounded-lg p-4">
                    <div className="text-sm text-muted-foreground">Total Active Time (All Employees)</div>
                    <div className="text-2xl font-bold mt-1 text-green-600">
                      {(() => {
                        const totalTime = (isRealTimeEnabled ? employeeStatusesState : employeeStatuses)
                          .reduce((total, emp) => {
                            // Ensure totalActiveTime is a valid number and not excessive
                            const activeTime = typeof emp.totalActiveTime === 'number' &&
                              !isNaN(emp.totalActiveTime) &&
                              isFinite(emp.totalActiveTime) ?
                              Math.min(emp.totalActiveTime, MAX_SHIFT_DURATION_SECONDS) : 0;

                            console.log(`Employee ${emp.name} active time: ${activeTime} (original: ${emp.totalActiveTime})`);
                            return total + activeTime;
                          }, 0);
                        console.log('Total active time on initial load:', totalTime);
                        return formatSeconds(totalTime);
                      })()}
                    </div>
                  </div>
                  <div className="bg-amber-500/10 rounded-lg p-4">
                    <div className="text-sm text-muted-foreground">Total Break Time (All Employees)</div>
                    <div className="text-2xl font-bold mt-1 text-amber-600">
                      {formatSeconds((isRealTimeEnabled ? employeeStatusesState : employeeStatuses)
                        .reduce((total, emp) => {
                          // Ensure totalBreakTime is a valid number and not excessive
                          const breakTime = typeof emp.totalBreakTime === 'number' &&
                            !isNaN(emp.totalBreakTime) &&
                            isFinite(emp.totalBreakTime) ?
                            Math.min(emp.totalBreakTime, MAX_SHIFT_DURATION_SECONDS) : 0;
                          return total + breakTime;
                        }, 0))}
                    </div>
                  </div>
                </div>
              )}

              {/* All Employees Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Employee</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Department</th>
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
                      // Find the department in our already-processed departmentsArray
                      // This ensures we're using the same sanitized department data everywhere
                      let departmentInfo = {
                        name: 'Unknown',
                        shift_start_time: null,
                        shift_end_time: null,
                        grace_period_minutes: 30
                      };

                      try {
                        // Get department ID with fallback
                        const deptId = employee.department_id || 'unassigned';

                        // First try to find the department in our departmentsArray
                        // This is the most reliable source since we've already sanitized it
                        const foundDept = departmentsArray.find(dept => dept.id === deptId);

                        if (foundDept) {
                          // Use the department from our array
                          departmentInfo = {
                            name: foundDept.name,
                            shift_start_time: foundDept.shift_start_time,
                            shift_end_time: foundDept.shift_end_time,
                            grace_period_minutes: foundDept.grace_period_minutes
                          };
                        } else {
                          // Fallback: Special case for unassigned
                          if (deptId === 'unassigned') {
                            departmentInfo.name = 'Unassigned';
                          } else {
                            // Fallback: Try to get from the department map
                            const deptMap = isRealTimeEnabled ? departmentMapState : departmentMap;

                            if (deptMap && typeof deptMap === 'object') {
                              const deptInfo = deptMap[deptId];

                              if (deptInfo) {
                                if (typeof deptInfo === 'string') {
                                  // If it's a string, use it as the name
                                  departmentInfo.name = String(deptInfo);
                                } else if (typeof deptInfo === 'object' && deptInfo !== null) {
                                  // If it's an object, extract properties safely
                                  if ('name' in deptInfo && deptInfo.name != null) {
                                    departmentInfo.name = String(deptInfo.name);
                                  }

                                  if ('shift_start_time' in deptInfo) {
                                    departmentInfo.shift_start_time = deptInfo.shift_start_time;
                                  }

                                  if ('shift_end_time' in deptInfo) {
                                    departmentInfo.shift_end_time = deptInfo.shift_end_time;
                                  }

                                  if ('grace_period_minutes' in deptInfo &&
                                      typeof deptInfo.grace_period_minutes === 'number') {
                                    departmentInfo.grace_period_minutes = deptInfo.grace_period_minutes;
                                  }
                                }
                              } else {
                                // If no department info found, use the ID as the name
                                departmentInfo.name = `Department ${deptId}`;
                              }
                            }
                          }
                        }
                      } catch (error) {
                        console.error(`Error getting department info for employee ${employee.id}:`, error);
                        // Keep default values set above
                      }

                      // Always ensure name is a string
                      const departmentName = String(departmentInfo.name || 'Unknown');
                      const shiftStartTime = departmentInfo.shift_start_time;

                      return (
                        <tr key={employee.id} className="border-t border-border hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">{employee.name}</td>
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
                              <Link href={`/admin/reports?employeeId=${employee.id}`}>
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
                        <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                          No employees found. Please add employees to see their status here.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* Department-specific tabs */}
            {departmentsArray.map(dept => (
              <TabsContent key={dept.id} value={dept.id}>
                <div className="bg-primary/5 p-4 rounded-lg mb-4">
                  <h3 className="text-lg font-semibold flex items-center">
                    <BuildingOfficeIcon className="h-5 w-5 mr-2 text-primary" />
                    {dept.name} Department
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {dept.employees.length} employees | {dept.employees.filter(e => e.status === 'signed_in').length} active | {dept.employees.filter(e => e.status === 'on_break').length} on break
                  </p>

                  {/* Department time summary */}
                  {dept.employees.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                      <div className="bg-green-500/10 rounded-lg p-3">
                        <div className="text-xs text-muted-foreground">Total Active Time</div>
                        <div className="text-lg font-bold mt-1 text-green-600">
                          {formatSeconds(dept.employees.reduce((total, emp) => {
                            // Ensure totalActiveTime is a valid number and not excessive
                            const activeTime = typeof emp.totalActiveTime === 'number' &&
                              !isNaN(emp.totalActiveTime) &&
                              isFinite(emp.totalActiveTime) ?
                              Math.min(emp.totalActiveTime, MAX_SHIFT_DURATION_SECONDS) : 0;
                            return total + activeTime;
                          }, 0))}
                        </div>
                      </div>
                      <div className="bg-amber-500/10 rounded-lg p-3">
                        <div className="text-xs text-muted-foreground">Total Break Time</div>
                        <div className="text-lg font-bold mt-1 text-amber-600">
                          {formatSeconds(dept.employees.reduce((total, emp) => {
                            // Ensure totalBreakTime is a valid number and not excessive
                            const breakTime = typeof emp.totalBreakTime === 'number' &&
                              !isNaN(emp.totalBreakTime) &&
                              isFinite(emp.totalBreakTime) ?
                              Math.min(emp.totalBreakTime, MAX_SHIFT_DURATION_SECONDS) : 0;
                            return total + breakTime;
                          }, 0))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

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
                      {dept.employees.map((employee) => {
                        // Use the department info directly from the dept object
                        // Since we've already sanitized it in the departmentsArray creation
                        let departmentInfo = dept;

                        // Ensure we have all required properties with fallbacks
                        if (!departmentInfo.shift_start_time) departmentInfo.shift_start_time = null;
                        if (!departmentInfo.shift_end_time) departmentInfo.shift_end_time = null;
                        if (!departmentInfo.grace_period_minutes) departmentInfo.grace_period_minutes = 30;

                        // Always ensure name is a string
                        if (typeof departmentInfo.name !== 'string') {
                          departmentInfo.name = String(departmentInfo.name || `Department ${dept.id}`);
                        }

                        const shiftStartTime = departmentInfo.shift_start_time;

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
                                  shiftStartTime={shiftStartTime}
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
                                <Link href={`/admin/reports?employeeId=${employee.id}`}>
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
                      {dept.employees.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                            No employees found in this department.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-end border-t pt-4">
          <div className="flex gap-2">
            <Link href="/admin/reports">
              <Button variant="outline" size="sm">
                View Detailed Reports
              </Button>
            </Link>
            <Link href="/admin/employees">
              <Button size="sm">
                Manage Employees
              </Button>
            </Link>
          </div>
        </CardFooter>
      </Card>

      {/* Recent Activity */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest attendance events from all employees
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentLogs && recentLogs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Employee</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Department</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Event</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Date</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(isRealTimeEnabled ? recentLogsState : recentLogs).map(log => {
                      // Get employee name from the log
                      const employeeName = log.userName || 'Unknown Employee';

                      // Get department name from the log
                      const departmentName = log.departmentName || 'Unknown';

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
                          <td className="px-4 py-3 text-muted-foreground">{departmentName}</td>
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
          <Link href="/admin/reports">
            <Button variant="outline" size="sm">
              View All Activity
            </Button>
          </Link>
        </CardFooter>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/admin/employees">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Manage Employees</CardTitle>
                <CardDescription>
                  Add, edit, or remove employees
                </CardDescription>
              </div>
              <UsersIcon className="h-6 w-6 text-primary" />
            </CardHeader>
          </Card>
        </Link>
        <Link href="/admin/departments">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Manage Departments</CardTitle>
                <CardDescription>
                  Create and manage departments
                </CardDescription>
              </div>
              <BuildingOfficeIcon className="h-6 w-6 text-primary" />
            </CardHeader>
          </Card>
        </Link>
        <Link href="/admin/reports">
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
      </div>
    </div>
  );
};

export default AdminDashboardContent;
