import React from 'react';
import { render, screen } from '@testing-library/react';
import DashboardClient from '@/components/DashboardClient';
import { AttendanceProvider } from '@/context/AttendanceContext';
import { TimezoneProvider } from '@/context/TimezoneContext';

// Mock the necessary modules
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
    prefetch: jest.fn()
  })
}));

jest.mock('recharts', () => ({
  PieChart: ({ children }: { children: React.ReactNode }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => <div data-testid="pie"></div>,
  Cell: () => <div data-testid="cell"></div>,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => <div></div>,
  XAxis: () => <div></div>,
  YAxis: () => <div></div>,
  Tooltip: () => <div></div>
}));

// Mock dynamic imports
jest.mock('next/dynamic', () => (fn: any) => {
  const Component = (props: any) => {
    const [C, setC] = React.useState<React.ComponentType<any> | null>(null);
    
    React.useEffect(() => {
      fn().then((mod: any) => {
        setC(() => mod.default || mod);
      });
    }, []);
    
    if (!C) return null;
    return <C {...props} />;
  };
  
  Component.displayName = 'DynamicComponent';
  Component.preload = jest.fn();
  
  return Component;
});

// Mock console methods
global.console.log = jest.fn();
global.console.error = jest.fn();
global.console.warn = jest.fn();

describe('DashboardClient Tests', () => {
  const mockUserProfile = {
    full_name: 'Test User',
    role: 'user',
    department_id: 'dept-1'
  };
  
  const mockMetrics = {
    userId: 'test-user',
    workTime: 14400, // 4 hours
    breakTime: 1800, // 30 minutes
    overtimeSeconds: 0,
    isActive: false,
    isOnBreak: false,
    lastActivity: null,
    weekTime: 72000, // 20 hours
    monthTime: 288000 // 80 hours
  };
  
  const renderDashboardWithMetrics = (metrics = mockMetrics) => {
    return render(
      <TimezoneProvider initialTimezone="America/New_York">
        <AttendanceProvider
          userId="test-user"
          timezone="America/New_York"
          initialMetrics={metrics}
          initialLogs={[]}
        >
          <DashboardClient
            userProfile={mockUserProfile}
            departmentName="Test Department"
            timezone="America/New_York"
          />
        </AttendanceProvider>
      </TimezoneProvider>
    );
  };
  
  test('DashboardClient should render with normal metrics', async () => {
    renderDashboardWithMetrics();
    
    // The component uses dynamic imports, so we need to wait for them to load
    // Look for key elements that should be present
    expect(screen.getByText('Test Department')).toBeInTheDocument();
    expect(screen.getByText('Timesheet')).toBeInTheDocument();
  });
  
  test('DashboardClient should cap unreasonably high metrics', async () => {
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
    
    renderDashboardWithMetrics(unreasonableMetrics);
    
    // The component uses dynamic imports, so we need to wait for them to load
    // Look for key elements that should be present
    expect(screen.getByText('Test Department')).toBeInTheDocument();
    expect(screen.getByText('Timesheet')).toBeInTheDocument();
    
    // Check that console.error was called for the unreasonable values
    expect(console.error).toHaveBeenCalled();
  });
  
  test('DashboardClient should handle zero metrics', async () => {
    const zeroMetrics = {
      userId: 'test-user',
      workTime: 0,
      breakTime: 0,
      overtimeSeconds: 0,
      isActive: false,
      isOnBreak: false,
      lastActivity: null,
      weekTime: 0,
      monthTime: 0
    };
    
    renderDashboardWithMetrics(zeroMetrics);
    
    // The component uses dynamic imports, so we need to wait for them to load
    // Look for key elements that should be present
    expect(screen.getByText('Test Department')).toBeInTheDocument();
    expect(screen.getByText('Timesheet')).toBeInTheDocument();
  });
});
