'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ChartBarIcon, DocumentTextIcon, UsersIcon, ClockIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useLoading } from '@/context/LoadingContext';

// Type for employee status
type EmployeeStatus = {
  id: string;
  name: string;
  status: 'signed_in' | 'signed_out' | 'on_break';
  lastActivity: string;
  lastActivityTime: string;
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
  };
}

const ManagerDashboardContent: React.FC<ManagerDashboardContentProps> = ({ initialData }) => {
  const { stopLoading } = useLoading();
  const [isClient, setIsClient] = useState(false);

  // Extract data from props
  const {
    employeeStatuses,
    employeesInDepartment,
    activeEmployeeCount,
    todayLogsCount,
    departmentMap,
    managerProfile,
    recentLogs,
    today
  } = initialData;

  useEffect(() => {
    setIsClient(true);
    stopLoading();
  }, [stopLoading]);

  // Helper function to get activity label
  function getActivityLabel(status: 'signed_in' | 'signed_out' | 'on_break'): string {
    switch (status) {
      case 'signed_in': return 'Signed In';
      case 'signed_out': return 'Signed Out';
      case 'on_break': return 'On Break';
    }
  }

  if (!isClient) {
    return <LoadingSpinner size="lg" />;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col mb-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-foreground">Manager Dashboard</h1>
          <div className="text-sm text-muted-foreground">
            {format(today, 'EEEE, MMMM d, yyyy')}
          </div>
        </div>

        {/* Manager's Department Banner */}
        {managerProfile?.department_id && (
          <div className="mt-2 flex items-center">
            <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg flex items-center">
              <BuildingOfficeIcon className="h-5 w-5 mr-2" />
              <span className="font-medium">
                Department: {departmentMap.get(managerProfile.department_id) || 'Unknown'}
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
            <div className="text-3xl font-bold">{employeesInDepartment.length}</div>
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
            <div className="text-3xl font-bold">{activeEmployeeCount || 0}</div>
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
            <div className="text-3xl font-bold">{todayLogsCount || 0}</div>
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
                {managerProfile?.department_id
                  ? `${departmentMap.get(managerProfile.department_id) || 'Your'} Department`
                  : 'All Employees'}
              </CardDescription>
            </div>
            <Badge variant="outline" className="ml-2">
              {format(today, 'MMM d, yyyy')}
            </Badge>
          </div>
          {employeesInDepartment.length === 0 && (
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

          {/* Team Members Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Team Member</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Department</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Last Activity</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Time</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employeeStatuses.map((employee) => {
                  // Find the employee in the original data to get department
                  const employeeData = employeesInDepartment.find(emp => emp && emp.id === employee.id);
                  const departmentName = employeeData && employeeData.department_id
                    ? departmentMap.get(employeeData.department_id) || 'Unknown'
                    : 'None';

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
                      <td className="px-4 py-3 text-muted-foreground">{employee.lastActivity}</td>
                      <td className="px-4 py-3 text-muted-foreground">{employee.lastActivityTime}</td>
                      <td className="px-4 py-3">
                        <Link href={`/mgmt/reports?employeeId=${employee.id}`}>
                          <Button variant="ghost" size="sm">View History</Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
                {employeeStatuses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      No team members found in your department. Please contact an administrator to add team members.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end border-t pt-4">
          <div className="flex gap-2">
            <Link href="/mgmt/reports">
              <Button variant="outline" size="sm">
                View Detailed Reports
              </Button>
            </Link>
            <Link href="/mgmt/adjustments">
              <Button size="sm">
                Manage Adjustments
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
              <CardTitle>Recent Team Activity</CardTitle>
              <CardDescription>
                Latest attendance events from your team members
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
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Team Member</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Event</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Date</th>
                      <th className="px-4 py-2 text-left font-medium text-muted-foreground">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentLogs.map(log => {
                      // Find employee name
                      const employee = employeesInDepartment.find(emp => emp && emp.id === log.user_id);
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

                      // Format timestamp
                      const timestamp = new Date(log.timestamp);
                      const dateStr = format(timestamp, 'MMM d, yyyy');
                      const timeStr = format(timestamp, 'h:mm a');

                      return (
                        <tr key={log.id} className="border-t border-border hover:bg-muted/20">
                          <td className="px-4 py-3 font-medium">{employeeName}</td>
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        <Link href="/mgmt/adjustments">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Manage Adjustments</CardTitle>
                <CardDescription>
                  Add or edit attendance adjustments for your team
                </CardDescription>
              </div>
              <ClockIcon className="h-6 w-6 text-primary" />
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
};

export default ManagerDashboardContent;
