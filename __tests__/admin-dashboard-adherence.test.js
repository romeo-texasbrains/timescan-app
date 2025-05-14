/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import AdminDashboardContent from '../app/(app)/admin/dashboard/AdminDashboardContent';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';

// Mock the components used in AdminDashboardContent
jest.mock('@/components/AdherenceBadge', () => {
  return function MockAdherenceBadge({ status }) {
    return <div data-testid={`adherence-badge-${status}`}>{status}</div>;
  };
});

jest.mock('@/components/AbsentMarkingButton', () => {
  return function MockAbsentMarkingButton({ userId, employeeName }) {
    return <button data-testid={`absent-button-${userId}`}>Mark {employeeName} Absent</button>;
  };
});

// Mock the Supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn()
}));

// Mock other dependencies
jest.mock('date-fns', () => ({
  ...jest.requireActual('date-fns'),
  format: jest.fn().mockReturnValue('2023-01-01')
}));

jest.mock('date-fns-tz', () => ({
  formatInTimeZone: jest.fn().mockReturnValue('10:00 AM')
}));

jest.mock('next/link', () => {
  return ({ children, href }) => <a href={href}>{children}</a>;
});

jest.mock('@/context/LoadingContext', () => ({
  useLoading: () => ({
    stopLoading: jest.fn()
  })
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  }
}));

// Mock the UI components
jest.mock('@/components/ui/card', () => ({
  Card: ({ children }) => <div data-testid="card">{children}</div>,
  CardHeader: ({ children }) => <div data-testid="card-header">{children}</div>,
  CardTitle: ({ children }) => <div data-testid="card-title">{children}</div>,
  CardDescription: ({ children }) => <div data-testid="card-description">{children}</div>,
  CardContent: ({ children }) => <div data-testid="card-content">{children}</div>,
  CardFooter: ({ children }) => <div data-testid="card-footer">{children}</div>
}));

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }) => <div data-testid="tabs">{children}</div>,
  TabsList: ({ children }) => <div data-testid="tabs-list">{children}</div>,
  TabsTrigger: ({ children }) => <div data-testid="tabs-trigger">{children}</div>,
  TabsContent: ({ children, value }) => <div data-testid={`tabs-content-${value}`}>{children}</div>
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }) => <div data-testid="badge">{children}</div>
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children }) => <button>{children}</button>
}));

jest.mock('@/components/ChangeStatusDropdown', () => {
  return function MockChangeStatusDropdown() {
    return <div data-testid="change-status-dropdown">Change Status</div>;
  };
});

describe('Admin Dashboard Adherence Tests', () => {
  let mockSupabase;
  
  beforeEach(() => {
    // Reset mocks
    createClient.mockReset();
    
    // Setup mock Supabase client
    mockSupabase = {
      channel: jest.fn().mockReturnThis(),
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
      removeChannel: jest.fn(),
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      rpc: jest.fn().mockReturnValue({
        data: true,
        error: null
      })
    };
    
    createClient.mockReturnValue(mockSupabase);
  });
  
  it('displays adherence status for employees', async () => {
    // Mock the initial data
    const initialData = {
      employeeStatuses: [
        {
          id: 'user1',
          name: 'John Doe',
          status: 'signed_in',
          lastActivity: 'Signed In',
          lastActivityTime: '10:00 AM',
          department_id: 'dept1',
          totalActiveTime: 3600,
          totalBreakTime: 0,
          adherence: 'early',
          eligible_for_absent: false
        },
        {
          id: 'user2',
          name: 'Jane Smith',
          status: 'signed_in',
          lastActivity: 'Signed In',
          lastActivityTime: '10:30 AM',
          department_id: 'dept1',
          totalActiveTime: 3000,
          totalBreakTime: 0,
          adherence: 'late',
          eligible_for_absent: true
        }
      ],
      employeesByDepartment: {
        dept1: [
          {
            id: 'user1',
            name: 'John Doe',
            status: 'signed_in',
            lastActivity: 'Signed In',
            lastActivityTime: '10:00 AM',
            department_id: 'dept1',
            totalActiveTime: 3600,
            totalBreakTime: 0,
            adherence: 'early',
            eligible_for_absent: false
          },
          {
            id: 'user2',
            name: 'Jane Smith',
            status: 'signed_in',
            lastActivity: 'Signed In',
            lastActivityTime: '10:30 AM',
            department_id: 'dept1',
            totalActiveTime: 3000,
            totalBreakTime: 0,
            adherence: 'late',
            eligible_for_absent: true
          }
        ]
      },
      allEmployees: [
        { id: 'user1', full_name: 'John Doe', department_id: 'dept1' },
        { id: 'user2', full_name: 'Jane Smith', department_id: 'dept1' }
      ],
      activeEmployeeCount: 2,
      todayLogsCount: 4,
      departmentMap: {
        dept1: {
          name: 'Engineering',
          shift_start_time: '09:00:00',
          shift_end_time: '17:00:00',
          grace_period_minutes: 30
        }
      },
      recentLogs: [],
      today: new Date(),
      timezone: 'America/New_York'
    };

    // Render the component
    render(<AdminDashboardContent initialData={initialData} />);
    
    // Wait for the component to render
    await waitFor(() => {
      // Check that adherence badges are displayed
      expect(screen.getByTestId('adherence-badge-early')).toBeInTheDocument();
      expect(screen.getByTestId('adherence-badge-late')).toBeInTheDocument();
      
      // Check that the absent marking button is displayed for eligible employees
      expect(screen.getByTestId('absent-button-user2')).toBeInTheDocument();
      
      // Check that the absent marking button is not displayed for non-eligible employees
      expect(screen.queryByTestId('absent-button-user1')).not.toBeInTheDocument();
    });
  });
});
