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
    timezone = 'UTC'
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
    stopLoading
  ]);

  // Set up real-time subscription
  useEffect(() => {
    if (!isClient || !isRealTimeEnabled) return;

    const supabase = createClient();
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    // Subscribe to attendance_logs table changes
    const subscription = supabase
      .channel('admin-dashboard-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'attendance_logs',
        filter: `timestamp=gte.${todayStr}T00:00:00`
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

      // Fetch recent logs
      const { data: newRecentLogs } = await supabase
        .from('attendance_logs')
        .select('id, user_id, event_type, timestamp')
        .order('timestamp', { ascending: false })
        .limit(20);

      if (newRecentLogs) {
        setRecentLogsState(newRecentLogs);
      }

      // Fetch today's logs for processing employee statuses
      const { data: todayLogs } = await supabase
        .from('attendance_logs')
        .select('id, user_id, event_type, timestamp')
        .gte('timestamp', `${todayStr}T00:00:00`)
        .lte('timestamp', `${todayStr}T23:59:59`)
        .order('timestamp', { ascending: true });

      if (todayLogs && allEmployeesState.length > 0) {
        // Process employee statuses (similar to server-side logic)
        const newEmployeeStatuses: any[] = [];
        const activeEmployeeIds = new Set<string>();

        // Create maps to track active periods and break periods
        const employeeActivePeriods = new Map<string, { start: Date, periods: { start: Date, end: Date }[] }>();
        const employeeBreakPeriods = new Map<string, { start: Date, periods: { start: Date, end: Date }[] }>();

        // Create a map of the latest status for each employee
        const latestStatusMap = new Map<string, { status: 'signed_in' | 'signed_out' | 'on_break', timestamp: string }>();

        // Process logs chronologically
        todayLogs.forEach(log => {
          const timestamp = new Date(log.timestamp);
          const userId = log.user_id;

          // Update latest status
          let status: 'signed_in' | 'signed_out' | 'on_break' = 'signed_out';

          if (log.event_type === 'signin') {
            // Start tracking active time
            if (!employeeActivePeriods.has(userId)) {
              employeeActivePeriods.set(userId, { start: timestamp, periods: [] });
            } else if (!employeeActivePeriods.get(userId)!.start) {
              employeeActivePeriods.get(userId)!.start = timestamp;
            }

            status = 'signed_in';
            activeEmployeeIds.add(userId);
          }
          else if (log.event_type === 'signout') {
            // End active period if exists
            if (employeeActivePeriods.has(userId) && employeeActivePeriods.get(userId)!.start) {
              const activePeriod = employeeActivePeriods.get(userId)!;
              activePeriod.periods.push({
                start: activePeriod.start,
                end: timestamp
              });
              activePeriod.start = null as unknown as Date; // Clear start time
            }

            // End break period if exists
            if (employeeBreakPeriods.has(userId) && employeeBreakPeriods.get(userId)!.start) {
              const breakPeriod = employeeBreakPeriods.get(userId)!;
              breakPeriod.periods.push({
                start: breakPeriod.start,
                end: timestamp
              });
              breakPeriod.start = null as unknown as Date; // Clear start time
            }

            status = 'signed_out';
          }
          else if (log.event_type === 'break_start') {
            // End active period if exists
            if (employeeActivePeriods.has(userId) && employeeActivePeriods.get(userId)!.start) {
              const activePeriod = employeeActivePeriods.get(userId)!;
              activePeriod.periods.push({
                start: activePeriod.start,
                end: timestamp
              });
              activePeriod.start = null as unknown as Date; // Clear start time
            }

            // Start break period
            if (!employeeBreakPeriods.has(userId)) {
              employeeBreakPeriods.set(userId, { start: timestamp, periods: [] });
            } else {
              employeeBreakPeriods.get(userId)!.start = timestamp;
            }

            status = 'on_break';
            activeEmployeeIds.add(userId);
          }
          else if (log.event_type === 'break_end') {
            // End break period if exists
            if (employeeBreakPeriods.has(userId) && employeeBreakPeriods.get(userId)!.start) {
              const breakPeriod = employeeBreakPeriods.get(userId)!;
              breakPeriod.periods.push({
                start: breakPeriod.start,
                end: timestamp
              });
              breakPeriod.start = null as unknown as Date; // Clear start time
            }

            // Start active period
            if (!employeeActivePeriods.has(userId)) {
              employeeActivePeriods.set(userId, { start: timestamp, periods: [] });
            } else {
              employeeActivePeriods.get(userId)!.start = timestamp;
            }

            status = 'signed_in';
            activeEmployeeIds.add(userId);
          }

          // Update latest status
          if (!latestStatusMap.has(userId) ||
              new Date(latestStatusMap.get(userId)!.timestamp) < timestamp) {
            latestStatusMap.set(userId, { status, timestamp: log.timestamp });
          }
        });

        // Close any open periods with current time for employees still active
        const now = new Date();

        employeeActivePeriods.forEach((data, userId) => {
          if (data.start) {
            data.periods.push({ start: data.start, end: now });
          }
        });

        employeeBreakPeriods.forEach((data, userId) => {
          if (data.start) {
            data.periods.push({ start: data.start, end: now });
          }
        });

        // Calculate total times for each employee in seconds (to match employee dashboard)
        const calculateTotalSeconds = (periods: { start: Date, end: Date }[]): number => {
          return periods.reduce((total, period) => {
            const seconds = (period.end.getTime() - period.start.getTime()) / 1000;
            // Apply capping to prevent unreasonably long durations
            const { durationSeconds } = capShiftDuration(period.start.getTime(), period.end.getTime());
            return total + durationSeconds;
          }, 0);
        };

        // Create employee status objects
        allEmployeesState.forEach(employee => {
          // Skip if employee is undefined or doesn't have an id
          if (!employee || !employee.id) return;

          const latestStatus = latestStatusMap.get(employee.id);
          const totalActiveSeconds = employeeActivePeriods.has(employee.id)
            ? calculateTotalSeconds(employeeActivePeriods.get(employee.id)!.periods)
            : 0;

          const totalBreakSeconds = employeeBreakPeriods.has(employee.id)
            ? calculateTotalSeconds(employeeBreakPeriods.get(employee.id)!.periods)
            : 0;

          // Get all logs for this employee
          const employeeLogs = todayLogs.filter(log => log.user_id === employee.id);

          // Use our utility function to determine the current status
          const currentStatus = determineUserStatus(employeeLogs);

          if (latestStatus) {
            newEmployeeStatuses.push({
              id: employee.id,
              name: employee.full_name || 'Unnamed',
              status: currentStatus, // Use our utility function instead of latestStatus.status
              lastActivity: getStatusLabel(currentStatus),
              lastActivityTime: formatInTimeZone(parseISO(latestStatus.timestamp), timezoneState, 'h:mm a'),
              department_id: employee.department_id || 'unassigned',
              totalActiveTime: totalActiveSeconds,
              totalBreakTime: totalBreakSeconds
            });
          } else {
            newEmployeeStatuses.push({
              id: employee.id,
              name: employee.full_name || 'Unnamed',
              status: 'signed_out',
              lastActivity: 'Not active today',
              lastActivityTime: '',
              department_id: employee.department_id || 'unassigned',
              totalActiveTime: 0,
              totalBreakTime: 0
            });
          }
        });

        // Sort employee statuses
        newEmployeeStatuses.sort((a, b) => {
          // Active employees first
          if (a.status !== 'signed_out' && b.status === 'signed_out') return -1;
          if (a.status === 'signed_out' && b.status !== 'signed_out') return 1;

          // Then sort by name
          return a.name.localeCompare(b.name);
        });

        // Group employees by department
        const newEmployeesByDepartment: Record<string, any[]> = {
          'unassigned': []
        };

        // Initialize with all departments
        Object.keys(departmentMapState).forEach(deptId => {
          newEmployeesByDepartment[deptId] = [];
        });

        // Populate departments with employees
        newEmployeeStatuses.forEach(employee => {
          const deptId = employee.department_id || 'unassigned';
          if (!newEmployeesByDepartment[deptId]) {
            newEmployeesByDepartment[deptId] = [];
          }
          newEmployeesByDepartment[deptId].push(employee);
        });

        // Update state
        setEmployeeStatusesState(newEmployeeStatuses);
        setEmployeesByDepartmentState(newEmployeesByDepartment);
        setActiveEmployeeCountState(activeEmployeeIds.size);
      }
    } catch (error) {
      console.error('Error refreshing dashboard data:', error);
      throw error;
    }
  };

  // We're now using the imported getStatusLabel function from our utility

  // Helper function to format seconds into hours and minutes (to match employee dashboard)
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
      await refreshDashboardData();
      setLastUpdateTime(new Date());

      // Debug: Log the total active time after refresh
      console.log('Client-side total active time after refresh:',
        employeeStatusesState.reduce((total, emp) => total + emp.totalActiveTime, 0));

      // Debug: Log each employee's active time
      employeeStatusesState.forEach(emp => {
        console.log(`Employee ${emp.name} active time after refresh: ${emp.totalActiveTime} seconds`);
      });

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

  if (!isClient) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Overview of all departments and employee attendance status
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
            <Badge variant="outline" className="ml-2">
              {format(today, 'MMM d, yyyy')}
            </Badge>
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
                      // Find employee name
                      const employee = (isRealTimeEnabled ? allEmployeesState : allEmployees).find(emp => emp && emp.id === log.user_id);
                      const employeeName = employee && employee.full_name ? employee.full_name : 'Unknown Employee';
                      // Get department info with proper type checking
                      let departmentName = 'Unknown';

                      try {
                        if (employee && employee.department_id) {
                          const deptId = employee.department_id;
                          const deptInfo = isRealTimeEnabled ? departmentMapState[deptId] : departmentMap[deptId];

                          if (deptInfo) {
                            // Handle string department names
                            if (typeof deptInfo === 'string') {
                              departmentName = deptInfo;
                            }
                            // Handle object department info
                            else if (typeof deptInfo === 'object' && deptInfo !== null) {
                              // Extract name with validation
                              if ('name' in deptInfo && typeof deptInfo.name === 'string') {
                                departmentName = deptInfo.name;
                              } else {
                                departmentName = `Department ${deptId}`;
                              }
                            }
                          }
                        } else {
                          departmentName = 'Unassigned';
                        }
                      } catch (error) {
                        console.error('Error getting department name:', error);
                        departmentName = 'Unknown';
                      }

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

                      // Format timestamp with timezone
                      const timestamp = parseISO(log.timestamp);
                      const dateStr = formatInTimeZone(timestamp, isRealTimeEnabled ? timezoneState : timezone, 'MMM d, yyyy');
                      const timeStr = formatInTimeZone(timestamp, isRealTimeEnabled ? timezoneState : timezone, 'h:mm a');

                      return (
                        <tr key={log.id} className="border-t border-border hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">{employeeName}</td>
                          <td className="px-4 py-3 text-muted-foreground">{departmentName}</td>
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
