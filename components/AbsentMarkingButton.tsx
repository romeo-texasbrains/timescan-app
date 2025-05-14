'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { markEmployeeAbsent } from '@/app/actions/attendanceActions';
import { toast } from 'sonner';

interface AbsentMarkingButtonProps {
  userId: string;
  employeeName: string;
  date: string;
  onSuccess?: () => void;
}

export default function AbsentMarkingButton({
  userId,
  employeeName,
  date,
  onSuccess
}: AbsentMarkingButtonProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleMarkAbsent = async () => {
    if (!confirmed) return;
    
    setIsLoading(true);
    try {
      const result = await markEmployeeAbsent({
        userId,
        date,
        markAbsent: true
      });
      
      if (result.success) {
        toast.success(result.message);
        setIsDialogOpen(false);
        if (onSuccess) onSuccess();
      } else {
        toast.error(result.message || 'Failed to mark employee as absent');
      }
    } catch (error) {
      console.error('Error marking employee as absent:', error);
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(false);
      setConfirmed(false);
    }
  };

  return (
    <>
      <Button 
        variant="destructive" 
        size="sm" 
        onClick={() => setIsDialogOpen(true)}
        className="whitespace-nowrap"
      >
        Mark Absent
      </Button>
      
      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Employee as Absent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark <strong>{employeeName}</strong> as absent for {date}?
              <div className="mt-4 mb-2">
                <p className="text-sm text-muted-foreground mb-2">
                  This will override any existing attendance status for this date.
                </p>
                <div className="flex items-center space-x-2 mt-4">
                  <Checkbox 
                    id="confirm" 
                    checked={confirmed} 
                    onCheckedChange={(checked) => setConfirmed(checked as boolean)} 
                  />
                  <label
                    htmlFor="confirm"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    I confirm this employee should be marked as absent
                  </label>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleMarkAbsent();
              }}
              disabled={!confirmed || isLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isLoading ? 'Marking...' : 'Mark Absent'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
