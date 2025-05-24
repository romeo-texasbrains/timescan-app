'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, subDays } from 'date-fns';
import { Loader2, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getAdherenceLabel } from '@/lib/utils/adherence-utils';
import { recalculateAdherence } from '@/app/actions/adherenceActions';

interface AdherenceManagementProps {
  initialRecentUpdates: any[];
  initialStatistics: any[];
  employees: any[];
}

export default function AdherenceManagement({
  initialRecentUpdates,
  initialStatistics,
  employees
}: AdherenceManagementProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [userId, setUserId] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('recalculate');

  // Handle recalculation using server action
  const handleRecalculate = async () => {
    try {
      setIsLoading(true);

      const formData = new FormData();
      formData.append('startDate', format(startDate, 'yyyy-MM-dd'));
      formData.append('endDate', format(endDate, 'yyyy-MM-dd'));

      if (userId !== 'all') {
        formData.append('userId', userId);
      }

      const result = await recalculateAdherence(formData);

      if (result.success) {
        toast.success(result.message);
        // Refresh the page to show updated data
        router.refresh();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error recalculating adherence:', error);
      toast.error('An error occurred during adherence recalculation');
    } finally {
      setIsLoading(false);
    }
  };

  // Load data when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // Data will be loaded server-side via the page refresh after recalculation
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Adherence Management</h1>

      <Tabs defaultValue="recalculate" onValueChange={handleTabChange}>
        <TabsList className="mb-6">
          <TabsTrigger value="recalculate">Recalculate Adherence</TabsTrigger>
          <TabsTrigger value="history">Recent Updates</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="recalculate">
          <Card>
            <CardHeader>
              <CardTitle>Recalculate Adherence Status</CardTitle>
              <CardDescription>
                Recalculate adherence status for all employees or a specific employee within a date range.
                This will update the attendance_adherence table based on attendance logs.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="date-range">Date Range</Label>
                  <div className="flex flex-col space-y-2 mt-2">
                    <div className="flex flex-col space-y-2">
                      <Label className="w-20">Start Date:</Label>
                      <DatePicker
                        date={startDate}
                        setDate={(date) => date && setStartDate(date)}
                        placeholder="Select start date"
                      />
                    </div>
                    <div className="flex flex-col space-y-2">
                      <Label className="w-20">End Date:</Label>
                      <DatePicker
                        date={endDate}
                        setDate={(date) => date && setEndDate(date)}
                        placeholder="Select end date"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="employee">Employee (Optional)</Label>
                  <Select value={userId} onValueChange={setUserId}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="All Employees" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Employees</SelectItem>
                      {employees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.full_name || employee.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground mt-2">
                    Leave empty to recalculate for all employees. This may take longer for large date ranges.
                  </p>

                  <Button
                    className="mt-6 w-full"
                    onClick={handleRecalculate}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Recalculate Adherence
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Recent Adherence Updates</CardTitle>
              <CardDescription>
                Recent changes to employee adherence status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {initialRecentUpdates.length > 0 ? (
                      initialRecentUpdates.map((update) => (
                        <TableRow key={update.id}>
                          <TableCell>{update.profiles ? update.profiles.full_name : 'Unknown'}</TableCell>
                          <TableCell>{format(new Date(update.date), 'MMM dd, yyyy')}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              update.status === 'early' ? 'bg-green-100 text-green-800' :
                              update.status === 'on_time' ? 'bg-blue-100 text-blue-800' :
                              update.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                              update.status === 'absent' ? 'bg-red-100 text-red-800' :
                              update.status === 'pending' ? 'bg-purple-100 text-purple-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {getAdherenceLabel(update.status)}
                            </span>
                          </TableCell>
                          <TableCell>{format(new Date(update.updated_at), 'MMM dd, yyyy HH:mm')}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-4">
                          No recent updates found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics">
          <Card>
            <CardHeader>
              <CardTitle>Today's Adherence Statistics</CardTitle>
              <CardDescription>
                Summary of adherence status for today
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  <StatCard
                    title="Early"
                    value={initialStatistics.find(s => s.status === 'early')?.count || 0}
                    color="green"
                    icon={<CheckCircle className="h-5 w-5" />}
                  />
                  <StatCard
                    title="On Time"
                    value={initialStatistics.find(s => s.status === 'on_time')?.count || 0}
                    color="blue"
                    icon={<CheckCircle className="h-5 w-5" />}
                  />
                  <StatCard
                    title="Late"
                    value={initialStatistics.find(s => s.status === 'late')?.count || 0}
                    color="yellow"
                    icon={<AlertCircle className="h-5 w-5" />}
                  />
                  <StatCard
                    title="Absent"
                    value={initialStatistics.find(s => s.status === 'absent')?.count || 0}
                    color="red"
                    icon={<AlertCircle className="h-5 w-5" />}
                  />
                  <StatCard
                    title="Pending"
                    value={initialStatistics.find(s => s.status === 'pending')?.count || 0}
                    color="purple"
                    icon={<AlertCircle className="h-5 w-5" />}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Stat card component
function StatCard({ title, value, color, icon }: { title: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold">{value}</p>
          </div>
          <div className={`p-2 rounded-full ${
            color === 'green' ? 'bg-green-100 text-green-600' :
            color === 'blue' ? 'bg-blue-100 text-blue-600' :
            color === 'yellow' ? 'bg-yellow-100 text-yellow-600' :
            color === 'red' ? 'bg-red-100 text-red-600' :
            color === 'purple' ? 'bg-purple-100 text-purple-600' :
            'bg-gray-100 text-gray-600'
          }`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
