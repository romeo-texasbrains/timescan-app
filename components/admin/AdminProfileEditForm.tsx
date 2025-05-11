'use client';

import { useState } from 'react';
import { Profile } from '@/lib/types/profile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials, formatDate, formatDateForInput } from '@/lib/types/profile';
import { toast } from 'sonner';
import {
  UserIcon,
  BuildingOfficeIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  IdentificationIcon,
  ClockIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Department {
  id: string;
  name: string;
}

interface AdminProfileEditFormProps {
  profile: Profile & { departments?: { name: string } };
  departments: Department[];
}

export default function AdminProfileEditForm({ profile, departments }: AdminProfileEditFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setIsSubmitting(true);
    try {
      // Create a new FormData object to send to the server
      const data = new FormData();
      data.append('id', profile.id);
      data.append('full_name', formData.get('full_name') as string);
      data.append('phone_number', formData.get('phone_number') as string);
      data.append('address', formData.get('address') as string);
      data.append('date_of_birth', formData.get('date_of_birth') as string);
      data.append('emergency_contact_name', formData.get('emergency_contact_name') as string);
      data.append('emergency_contact_relationship', formData.get('emergency_contact_relationship') as string);
      data.append('emergency_contact_phone', formData.get('emergency_contact_phone') as string);
      data.append('department_id', formData.get('department_id') as string);

      // Send the data to the server
      const response = await fetch(`/api/admin/profiles/${profile.id}`, {
        method: 'PUT',
        body: data,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update profile');
      }

      toast.success('Profile updated successfully');
      setIsEditing(false);

      // Refresh the page to show the updated data
      window.location.reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'An error occurred while updating the profile');
      console.error('Profile update error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Employee Profile</h1>
        <div className="flex gap-2">
          {!isEditing ? (
            <Button
              onClick={() => setIsEditing(true)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <PencilIcon className="h-4 w-4" />
              Edit Profile
            </Button>
          ) : (
            <Button
              onClick={() => setIsEditing(false)}
              variant="outline"
              className="flex items-center gap-2"
            >
              <XMarkIcon className="h-4 w-4" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      {isEditing ? (
        <form action={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column - Profile Picture and Basic Info */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="text-center pb-2">
                <Avatar className="h-32 w-32 mx-auto border-2 border-primary/20">
                  {profile.profile_picture_url ? (
                    <AvatarImage src={profile.profile_picture_url} alt={profile.full_name || ''} />
                  ) : (
                    <AvatarFallback className="bg-primary/10 text-primary text-4xl">
                      {profile.full_name ? getInitials(profile.full_name) : <UserIcon className="h-16 w-16" />}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="mt-4 space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    name="full_name"
                    defaultValue={profile.full_name || ''}
                    required
                  />
                </div>
                <div className="mt-2 space-y-2">
                  <Label htmlFor="department_id">Department</Label>
                  <Select name="department_id" defaultValue={profile.department_id || 'none'}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Department</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="mt-2 space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select name="role" defaultValue={profile.role || 'employee'}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Employee</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      defaultValue={profile.email || ''}
                      disabled
                      className="bg-muted/50"
                    />
                    <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone_number">Phone Number</Label>
                    <Input
                      id="phone_number"
                      name="phone_number"
                      defaultValue={profile.phone_number || ''}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="date_of_birth">Date of Birth</Label>
                    <Input
                      id="date_of_birth"
                      name="date_of_birth"
                      type="date"
                      defaultValue={formatDateForInput(profile.date_of_birth)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Detailed Information */}
          <div className="md:col-span-2 space-y-6">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Home Address</Label>
                  <Textarea
                    id="address"
                    name="address"
                    defaultValue={profile.address || ''}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Emergency Contact */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Emergency Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="emergency_contact_name">Contact Name</Label>
                  <Input
                    id="emergency_contact_name"
                    name="emergency_contact_name"
                    defaultValue={profile.emergency_contact_name || ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergency_contact_relationship">Relationship</Label>
                  <Input
                    id="emergency_contact_relationship"
                    name="emergency_contact_relationship"
                    defaultValue={profile.emergency_contact_relationship || ''}
                    placeholder="e.g., Spouse, Parent, Friend"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergency_contact_phone">Contact Phone</Label>
                  <Input
                    id="emergency_contact_phone"
                    name="emergency_contact_phone"
                    defaultValue={profile.emergency_contact_phone || ''}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-end">
                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column - Profile Picture and Basic Info */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="text-center pb-2">
                <Avatar className="h-32 w-32 mx-auto border-2 border-primary/20">
                  {profile.profile_picture_url ? (
                    <AvatarImage src={profile.profile_picture_url} alt={profile.full_name || ''} />
                  ) : (
                    <AvatarFallback className="bg-primary/10 text-primary text-4xl">
                      {profile.full_name ? getInitials(profile.full_name) : <UserIcon className="h-16 w-16" />}
                    </AvatarFallback>
                  )}
                </Avatar>
                <CardTitle className="mt-4 text-xl">{profile.full_name || 'Unnamed User'}</CardTitle>
                <CardDescription className="flex flex-col gap-1">
                  <span>{profile.departments?.name || 'No Department'}</span>
                  <span className="capitalize">{profile.role || 'Employee'}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <EnvelopeIcon className="h-5 w-5 text-muted-foreground" />
                    <span className="truncate">{profile.email || 'No email provided'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <PhoneIcon className="h-5 w-5 text-muted-foreground" />
                    <span>{profile.phone_number || 'No phone number provided'}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <ClockIcon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <span className="block">Birthday</span>
                      <span className="text-sm text-muted-foreground">{profile.date_of_birth ? formatDate(profile.date_of_birth) : 'Not set'}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Health Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Health Card</CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                {profile.health_card_url ? (
                  <a
                    href={profile.health_card_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block"
                  >
                    <Button>View Health Card</Button>
                  </a>
                ) : (
                  <p className="text-sm text-muted-foreground">No health card uploaded</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Detailed Information */}
          <div className="md:col-span-2 space-y-6">
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Home Address</h3>
                  <p className="text-sm">{profile.address || 'No address provided'}</p>
                </div>
              </CardContent>
            </Card>

            {/* Emergency Contact */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Emergency Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Contact Name</h3>
                  <p className="text-sm">{profile.emergency_contact_name || 'Not provided'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Relationship</h3>
                  <p className="text-sm">{profile.emergency_contact_relationship || 'Not provided'}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">Contact Phone</h3>
                  <p className="text-sm">{profile.emergency_contact_phone || 'Not provided'}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
