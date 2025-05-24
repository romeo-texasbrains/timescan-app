'use client';

import React, { useState, useEffect } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useLoading } from '@/context/LoadingContext';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AttendanceHistoryContentProps {
  initialData: {
    logs?: any[];
    groupedByDay?: Record<string, any[]>;
    startDate: string;
    endDate: string;
    timezone: string;
    users?: any[];
    userRole?: 'admin' | 'manager' | 'employee';
  };
}

export default function AttendanceHistoryContent({ initialData }: AttendanceHistoryContentProps) {
  // Extract data from props with safety checks
  const {
    logs: initialLogs = [],
    groupedByDay: initialGroupedByDay = {},
    startDate: initialStartDate = format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    endDate: initialEndDate = format(new Date(), 'yyyy-MM-dd'),
    timezone: initialTimezone = 'UTC',
    users: initialUsers = [],
    userRole: initialUserRole = 'employee'
  } = initialData || {};

  // State for filters and data
  const [startDate, setStartDate] = useState<Date>(parseISO(initialStartDate));
  const [endDate, setEndDate] = useState<Date>(parseISO(initialEndDate));
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [viewType, setViewType] = useState<'list' | 'daily'>('list');
  const [includeMetrics, setIncludeMetrics] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [logs, setLogs] = useState<any[]>(initialLogs);
  const [groupedByDay, setGroupedByDay] = useState<Record<string, any[]>>(initialGroupedByDay);
  const [timezone, setTimezone] = useState<string>(initialTimezone);
  const [users, setUsers] = useState<any[]>(initialUsers);
  const [userRole, setUserRole] = useState<string>(initialUserRole);
  const [isClient, setIsClient] = useState<boolean>(false);

  const { stopLoading } = useLoading();

  // Initialize state with initial data
  useEffect(() => {
    setLogs(initialLogs);
    setGroupedByDay(initialGroupedByDay);
    setTimezone(initialTimezone);
    setUsers(initialUsers);
    setUserRole(initialUserRole);
    setIsClient(true);
    stopLoading();
  }, [
    initialLogs,
    initialGroupedByDay,
    initialTimezone,
    initialUsers,
    initialUserRole,
    stopLoading
  ]);

  // Function to fetch attendance history
  const fetchAttendanceHistory = async () => {
    setIsLoading(true);

    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append('startDate', format(startDate, 'yyyy-MM-dd'));
      params.append('endDate', format(endDate, 'yyyy-MM-dd'));
      params.append('groupByDay', viewType === 'daily' ? 'true' : 'false');
      params.append('includeMetrics', includeMetrics ? 'true' : 'false');

      if (selectedUserId) {
        params.append('userId', selectedUserId);
      }

      // Fetch data from API
      const response = await fetch(`/api/attendance/history?${params.toString()}`, {
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
      if (viewType === 'daily') {
        setGroupedByDay(data.groupedByDay || {});
      } else {
        setLogs(data.logs || []);
      }

      setTimezone(data.timezone);

      toast.success('Attendance history loaded successfully');
    } catch (error) {
      console.error('Error fetching attendance history:', error);
      toast.error('Failed to load attendance history');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle filter changes
  const handleApplyFilters = () => {
    fetchAttendanceHistory();
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

  // Render date range picker
  const renderDateRangePicker = () => (
    <div className="flex flex-col md:flex-row gap-4 mb-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Start Date</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !startDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {startDate ? format(startDate, 'PPP') : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={startDate}
              onSelect={(date) => date && setStartDate(date)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">End Date</label>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal",
                !endDate && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {endDate ? format(endDate, 'PPP') : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={endDate}
              onSelect={(date) => date && setEndDate(date)}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>

      {(userRole === 'admin' || userRole === 'manager') && (
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
      )}

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">View Type</label>
        <Select value={viewType} onValueChange={(value: 'list' | 'daily') => setViewType(value)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select view type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="list">Chronological List</SelectItem>
            <SelectItem value="daily">Daily Summary</SelectItem>
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

  // Render chronological list view
  const renderListView = () => (
    <Card>
      <CardHeader>
        <CardTitle>Attendance Events</CardTitle>
        <CardDescription>
          Chronological list of attendance events from {format(startDate, 'MMM d, yyyy')} to {format(endDate, 'MMM d, yyyy')}
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
                    <th className="text-left py-2 font-medium">User</th>
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
                      <td className="py-2">{log.userName}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-4 text-center text-muted-foreground">
            No attendance events found for the selected period
          </div>
        )}
      </CardContent>
    </Card>
  );

  // Render daily summary view
  const renderDailyView = () => (
    <div className="space-y-6">
      {Object.keys(groupedByDay).length > 0 ? (
        Object.keys(groupedByDay)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime()) // Sort by date, newest first
          .map(day => (
            <Card key={day}>
              <CardHeader>
                <CardTitle>{format(parseISO(day), 'EEEE, MMMM d, yyyy')}</CardTitle>
                <CardDescription>
                  Daily attendance summary
                </CardDescription>
              </CardHeader>
              <CardContent>
                {groupedByDay[day].map(userDay => (
                  <div key={userDay.userId} className="mb-6 last:mb-0">
                    {(userRole === 'admin' || userRole === 'manager') && (
                      <h3 className="text-lg font-semibold mb-2">{userDay.userName}</h3>
                    )}

                    {includeMetrics && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div className="bg-muted p-3 rounded-md">
                          <div className="text-sm text-muted-foreground">Active Time</div>
                          <div className="text-lg font-medium">{formatSeconds(userDay.metrics.activeTime)}</div>
                        </div>
                        <div className="bg-muted p-3 rounded-md">
                          <div className="text-sm text-muted-foreground">Break Time</div>
                          <div className="text-lg font-medium">{formatSeconds(userDay.metrics.breakTime)}</div>
                        </div>
                        <div className="bg-muted p-3 rounded-md">
                          <div className="text-sm text-muted-foreground">Current Status</div>
                          <div className="text-lg font-medium">
                            {userDay.metrics.isActive ? 'Active' :
                             userDay.metrics.isOnBreak ? 'On Break' : 'Signed Out'}
                          </div>
                        </div>
                        <div className="bg-muted p-3 rounded-md">
                          <div className="text-sm text-muted-foreground">Last Activity</div>
                          <div className="text-lg font-medium">
                            {userDay.metrics.lastActivity ?
                              `${formatEventType(userDay.metrics.lastActivity.type)} at ${format(parseISO(userDay.metrics.lastActivity.timestamp), 'h:mm a')}` :
                              'None'}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-2 font-medium">Time</th>
                            <th className="text-left py-2 font-medium">Event</th>
                          </tr>
                        </thead>
                        <tbody>
                          {userDay.logs.length > 0 ? (
                            userDay.logs.map(log => (
                              <tr key={log.id} className="border-b">
                                <td className="py-2">{log.formattedTime}</td>
                                <td className="py-2">{formatEventType(log.eventType)}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={2} className="py-4 text-center text-muted-foreground">
                                No events recorded
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
      ) : (
        <Card>
          <CardContent className="py-6">
            <div className="text-center text-muted-foreground">
              No attendance data found for the selected period
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div className="container mx-auto p-4 md:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Attendance History</h1>
          <p className="text-muted-foreground mt-1">
            View and filter attendance records
          </p>
        </div>
        <div className="text-sm text-muted-foreground mt-4 md:mt-0">
          <span>Timezone: </span>
          <span className="font-medium">{timezone}</span>
        </div>
      </div>

      {renderDateRangePicker()}

      {viewType === 'list' ? renderListView() : renderDailyView()}
    </div>
  );
}
