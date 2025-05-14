'use client';

import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';

interface DeleteUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

export default function DeleteUserDialog({ 
  isOpen, 
  onClose, 
  userId, 
  userName 
}: DeleteUserDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletionMode, setDeletionMode] = useState<'account_only' | 'all_data'>('account_only');
  const [confirmText, setConfirmText] = useState('');
  const router = useRouter();

  const handleDelete = async () => {
    // Require confirmation text to match username
    if (confirmText !== userName) {
      toast.error('Confirmation text does not match the user name');
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}?mode=${deletionMode}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      toast.success(data.message || 'User deleted successfully');
      router.refresh(); // Refresh the page to update the user list
      onClose();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(error instanceof Error ? error.message : 'An unexpected error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete User
          </DialogTitle>
          <DialogDescription>
            You are about to delete the user <strong>{userName}</strong>. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Deletion Options</h3>
            <RadioGroup 
              value={deletionMode} 
              onValueChange={(value) => setDeletionMode(value as 'account_only' | 'all_data')}
              className="space-y-2"
            >
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="account_only" id="account_only" />
                <div className="grid gap-1">
                  <Label htmlFor="account_only" className="font-medium">
                    Delete account only
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    This will delete the user account but keep all attendance records and other data for reporting purposes.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-2">
                <RadioGroupItem value="all_data" id="all_data" />
                <div className="grid gap-1">
                  <Label htmlFor="all_data" className="font-medium">
                    Delete account and all data
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    This will permanently delete the user account and all associated data including attendance records, adherence data, and profile information.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm" className="text-sm font-medium">
              Type <strong>{userName}</strong> to confirm deletion
            </Label>
            <input
              id="confirm"
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder={`Type "${userName}" to confirm`}
            />
          </div>
        </div>

        <DialogFooter className="flex space-x-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting || confirmText !== userName}
          >
            {isDeleting ? 'Deleting...' : 'Delete User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
