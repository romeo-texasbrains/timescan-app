import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { AttendanceProvider, useAttendance } from '@/context/AttendanceContext';
import { createClient } from '@/lib/supabase/client';

// Mock the supabase client
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn()
}));

// Mock the metrics calculator
jest.mock('@/lib/utils/metrics-calculator', () => ({
  calculateUserAttendanceMetrics: jest.fn().mockImplementation((logs, timezone, userId) => ({
    userId,
    workTime: 3600, // 1 hour
    breakTime: 0,
    overtimeSeconds: 0,
    isActive: false,
    isOnBreak: false,
    lastActivity: null,
    weekTime: 3600,
    monthTime: 3600
  }))
}));

// Mock console methods
global.console.log = jest.fn();
global.console.error = jest.fn();
global.console.warn = jest.fn();

// Create a test component that uses the attendance context
const TestComponent = () => {
  const { metrics, isLoading } = useAttendance();
  return (
    <div>
      <div data-testid="work-time">{metrics.workTime}</div>
      <div data-testid="break-time">{metrics.breakTime}</div>
      <div data-testid="overtime">{metrics.overtimeSeconds}</div>
      <div data-testid="loading">{isLoading.toString()}</div>
    </div>
  );
};

describe('AttendanceContext Tests', () => {
  // Mock Supabase client implementation
  const mockSupabase = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    channel: jest.fn().mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn()
    }),
    removeChannel: jest.fn()
  };
  
  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });
  
  test('AttendanceProvider should use initialMetrics if provided', async () => {
    const initialMetrics = {
      userId: 'test-user',
      workTime: 7200, // 2 hours
      breakTime: 1800, // 30 minutes
      overtimeSeconds: 0,
      isActive: true,
      isOnBreak: false,
      lastActivity: null,
      weekTime: 7200,
      monthTime: 7200
    };
    
    const { getByTestId } = render(
      <AttendanceProvider
        userId="test-user"
        timezone="America/New_York"
        initialMetrics={initialMetrics}
        initialLogs={[]}
      >
        <TestComponent />
      </AttendanceProvider>
    );
    
    await waitFor(() => {
      expect(getByTestId('work-time').textContent).toBe('7200');
      expect(getByTestId('break-time').textContent).toBe('1800');
      expect(getByTestId('overtime').textContent).toBe('0');
    });
  });
  
  test('AttendanceProvider should fetch data if initialMetrics not provided', async () => {
    // Mock the Supabase response for logs
    mockSupabase.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [
              { id: '1', user_id: 'test-user', event_type: 'signin', timestamp: new Date().toISOString() }
            ],
            error: null
          })
        })
      })
    });
    
    const { getByTestId } = render(
      <AttendanceProvider
        userId="test-user"
        timezone="America/New_York"
        initialMetrics={null}
        initialLogs={[]}
      >
        <TestComponent />
      </AttendanceProvider>
    );
    
    // Initially loading
    expect(getByTestId('loading').textContent).toBe('true');
    
    // Wait for data to be loaded
    await waitFor(() => {
      expect(getByTestId('work-time').textContent).toBe('3600'); // From the mocked calculator
    });
  });
  
  test('AttendanceProvider should cap unreasonably high metrics', async () => {
    // Create metrics with unreasonably high values
    const unreasonableMetrics = {
      userId: 'test-user',
      workTime: 200000, // ~55.5 hours (unreasonable)
      breakTime: 50000, // ~13.9 hours (unreasonable)
      overtimeSeconds: 150000, // ~41.7 hours (unreasonable)
      isActive: false,
      isOnBreak: false,
      lastActivity: null,
      weekTime: 300000,
      monthTime: 500000
    };
    
    const { getByTestId } = render(
      <AttendanceProvider
        userId="test-user"
        timezone="America/New_York"
        initialMetrics={unreasonableMetrics}
        initialLogs={[]}
      >
        <TestComponent />
      </AttendanceProvider>
    );
    
    await waitFor(() => {
      // Work time should be capped at 24 hours (86400 seconds)
      expect(parseInt(getByTestId('work-time').textContent || '0')).toBeLessThanOrEqual(86400);
      
      // Break time should be reasonable
      expect(parseInt(getByTestId('break-time').textContent || '0')).toBeLessThanOrEqual(28800); // 8 hours
      
      // Overtime should be reasonable
      expect(parseInt(getByTestId('overtime').textContent || '0')).toBeLessThanOrEqual(57600); // 16 hours
    });
  });
});
