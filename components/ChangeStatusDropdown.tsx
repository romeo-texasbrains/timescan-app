'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SimpleDropdown, SimpleDropdownItem } from '@/components/ui/simple-dropdown';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { changeEmployeeStatus } from '@/app/actions/managerActions';
import { PencilIcon, CheckIcon, XMarkIcon, ClockIcon } from '@heroicons/react/24/outline';

type EmployeeStatus = 'signed_in' | 'signed_out' | 'on_break';

interface ChangeStatusDropdownProps {
  employeeId: string;
  employeeName: string;
  currentStatus: EmployeeStatus;
  onStatusChanged?: () => void;
}

export default function ChangeStatusDropdown({
  employeeId,
  employeeName,
  currentStatus,
  onStatusChanged
}: ChangeStatusDropdownProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<EmployeeStatus | null>(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStatusSelect = (status: EmployeeStatus) => {
    if (status === currentStatus) {
      toast.info(`${employeeName} is already ${getStatusLabel(status)}`);
      return;
    }

    setSelectedStatus(status);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!selectedStatus) return;

    setIsSubmitting(true);

    const formData = new FormData();
    formData.append('userId', employeeId);
    formData.append('newStatus', selectedStatus);
    formData.append('notes', notes);

    try {
      const result = await changeEmployeeStatus(formData);

      if (result.success) {
        toast.success(result.message);
        setIsDialogOpen(false);
        setNotes('');
        if (onStatusChanged) {
          onStatusChanged();
        }
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error('Error changing status:', error);
      toast.error('Failed to change status. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusLabel = (status: EmployeeStatus): string => {
    switch (status) {
      case 'signed_in': return 'Active';
      case 'signed_out': return 'Signed Out';
      case 'on_break': return 'On Break';
      default: return 'Unknown';
    }
  };

  const getStatusIcon = (status: EmployeeStatus) => {
    switch (status) {
      case 'signed_in': return <CheckIcon className="h-4 w-4 mr-2 text-green-500" />;
      case 'signed_out': return <XMarkIcon className="h-4 w-4 mr-2 text-red-500" />;
      case 'on_break': return <ClockIcon className="h-4 w-4 mr-2 text-amber-500" />;
      default: return null;
    }
  };

  return (
    <>
      <SimpleDropdown
        trigger={
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <span className="sr-only">Change status</span>
            <PencilIcon className="h-4 w-4" />
          </Button>
        }
        align="right"
      >
        <SimpleDropdownItem
          onClick={() => handleStatusSelect('signed_in')}
          disabled={currentStatus === 'signed_in'}
          className={currentStatus === 'signed_in' ? 'bg-green-50 text-green-700' : ''}
        >
          <CheckIcon className="h-4 w-4 mr-2 text-green-500" />
          <span>Set as Active</span>
        </SimpleDropdownItem>
        <SimpleDropdownItem
          onClick={() => handleStatusSelect('on_break')}
          disabled={currentStatus === 'on_break'}
          className={currentStatus === 'on_break' ? 'bg-amber-50 text-amber-700' : ''}
        >
          <ClockIcon className="h-4 w-4 mr-2 text-amber-500" />
          <span>Set as On Break</span>
        </SimpleDropdownItem>
        <SimpleDropdownItem
          onClick={() => handleStatusSelect('signed_out')}
          disabled={currentStatus === 'signed_out'}
          className={currentStatus === 'signed_out' ? 'bg-red-50 text-red-700' : ''}
        >
          <XMarkIcon className="h-4 w-4 mr-2 text-red-500" />
          <span>Set as Signed Out</span>
        </SimpleDropdownItem>
      </SimpleDropdown>

      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change Status for {employeeName}</AlertDialogTitle>
            <AlertDialogDescription>
              Please confirm you want to change the status of this employee.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center gap-4">
              <Label htmlFor="status" className="text-right">
                New Status:
              </Label>
              <div className="flex items-center font-medium">
                {selectedStatus && getStatusIcon(selectedStatus)}
                {selectedStatus && getStatusLabel(selectedStatus)}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes" className="text-right">
                Notes (optional):
              </Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this status change"
                className="col-span-3"
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
