'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { addEmployee } from '@/app/actions/adminActions';

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

export default function AddEmployeeForm() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('employee'); // Default role
  const [status, setStatus] = useState<FormStatus>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('submitting');
    setMessage('');

    // Prepare form data for the action
    const formData = {
      fullName,
      email,
      password,
      role,
    };

    try {
      // Call the server action directly
      const result = await addEmployee(formData);

      if (result.success) {
        setStatus('success');
        setMessage(result.message || 'Employee added successfully!');
        // Clear form after successful submission
        setFullName('');
        setEmail('');
        setPassword('');
        setRole('employee');
        // Redirect is handled by the server action itself
      } else {
        throw new Error(result.message || 'Failed to add employee.');
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        setStatus('error');
        setMessage(error.message || 'An unexpected error occurred.');
      } else {
        setStatus('error');
        setMessage('An unexpected error occurred.');
      }
      // Keep form populated on error so user can fix
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="fullName">Full Name</Label>
        <Input 
          id="fullName" 
          value={fullName} 
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)} 
          required 
        />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input 
          id="email" 
          type="email" 
          value={email} 
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)} 
          required 
          autoComplete="username"
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input 
          id="password" 
          type="password" 
          value={password} 
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} 
          required 
          minLength={8} // Add basic password requirement
          autoComplete="current-password"
        />
        <p className="text-xs text-muted-foreground mt-1">Minimum 8 characters required.</p>
      </div>
      <div>
        <Label htmlFor="role">Role</Label>
        <Select value={role} onValueChange={(value: string) => setRole(value)}>
          <SelectTrigger id="role">
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="employee">Employee</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <Button type="submit" disabled={status === 'submitting'} className="w-full">
        {status === 'submitting' ? 'Adding...' : 'Add Employee'}
      </Button>

      {message && (
        <p className={`text-sm ${status === 'error' ? 'text-red-600' : status === 'success' ? 'text-green-600' : 'text-gray-600'}`}>
          {message}
        </p>
      )}
    </form>
  );
} 