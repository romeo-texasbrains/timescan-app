import { calculateUserAttendanceMetrics } from '@/lib/utils/metrics-calculator';
import { formatInTimeZone } from 'date-fns-tz';
import { addHours, subDays } from 'date-fns';

// Mock console methods
global.console.log = jest.fn();
global.console.warn = jest.fn();
global.console.error = jest.fn();

describe('Integration Tests', () => {
  const userId = 'test-user-id';
  const timezone = 'America/New_York';
  
  // Helper function to create a timestamp for today at a specific hour/minute
  const createTodayTimestamp = (hours: number, minutes: number = 0) => {
    const now = new Date();
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);
    return formatInTimeZone(date, 'UTC', "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
  };
  
  // Helper function to create a timestamp for yesterday at a specific hour/minute
  const createYesterdayTimestamp = (hours: number, minutes: number = 0) => {
    const now = new Date();
    const yesterday = subDays(now, 1);
    const date = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), hours, minutes);
    return formatInTimeZone(date, 'UTC', "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
  };
  
  // Test 1: Mixed logs from yesterday and today should only count today's logs
  test('Mixed logs from yesterday and today should only count today logs', () => {
    const logs = [
      // Yesterday's logs - should be ignored
      { id: '1', user_id: userId, event_type: 'signin', timestamp: createYesterdayTimestamp(8, 0) },
      { id: '2', user_id: userId, event_type: 'break_start', timestamp: createYesterdayTimestamp(12, 0) },
      { id: '3', user_id: userId, event_type: 'break_end', timestamp: createYesterdayTimestamp(13, 0) },
      { id: '4', user_id: userId, event_type: 'signout', timestamp: createYesterdayTimestamp(17, 0) },
      
      // Today's logs - should be counted
      { id: '5', user_id: userId, event_type: 'signin', timestamp: createTodayTimestamp(9, 0) },
      { id: '6', user_id: userId, event_type: 'signout', timestamp: createTodayTimestamp(12, 0) }
    ];
    
    const metrics = calculateUserAttendanceMetrics(logs, timezone, userId);
    
    // Only today's logs should be counted: 3 hours = 10800 seconds
    expect(metrics.workTime).toBe(10800);
    expect(metrics.breakTime).toBe(0);
    expect(metrics.overtimeSeconds).toBe(0);
  });
  
  // Test 2: Logs with unreasonable durations should be capped
  test('Logs with unreasonable durations should be capped', () => {
    // Create a sign-in from 48 hours ago (which would be unreasonable)
    const now = new Date();
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(now.getDate() - 2);
    
    const logs = [
      { 
        id: '1', 
        user_id: userId, 
        event_type: 'signin', 
        timestamp: formatInTimeZone(twoDaysAgo, 'UTC', "yyyy-MM-dd'T'HH:mm:ss.SSSXXX") 
      },
      { 
        id: '2', 
        user_id: userId, 
        event_type: 'signout', 
        timestamp: createTodayTimestamp(12, 0) 
      }
    ];
    
    const metrics = calculateUserAttendanceMetrics(logs, timezone, userId);
    
    // Work time should be capped at 24 hours = 86400 seconds
    expect(metrics.workTime).toBeLessThanOrEqual(86400);
    expect(metrics.breakTime).toBe(0);
    // Overtime should be capped as well
    expect(metrics.overtimeSeconds).toBeLessThanOrEqual(57600); // 16 hours
  });
  
  // Test 3: Multiple sign-in/sign-out pairs in a day should be summed correctly
  test('Multiple sign-in/sign-out pairs in a day should be summed correctly', () => {
    const logs = [
      // Morning shift
      { id: '1', user_id: userId, event_type: 'signin', timestamp: createTodayTimestamp(9, 0) },
      { id: '2', user_id: userId, event_type: 'signout', timestamp: createTodayTimestamp(12, 0) },
      
      // Afternoon shift
      { id: '3', user_id: userId, event_type: 'signin', timestamp: createTodayTimestamp(13, 0) },
      { id: '4', user_id: userId, event_type: 'signout', timestamp: createTodayTimestamp(17, 0) }
    ];
    
    const metrics = calculateUserAttendanceMetrics(logs, timezone, userId);
    
    // 3 hours morning + 4 hours afternoon = 7 hours = 25200 seconds
    expect(metrics.workTime).toBe(25200);
    expect(metrics.breakTime).toBe(0);
    expect(metrics.overtimeSeconds).toBe(0);
  });
  
  // Test 4: Incomplete log pairs (missing sign-out) should handle current time correctly
  test('Incomplete log pairs should handle current time correctly', () => {
    // Create a sign-in from 2 hours ago
    const now = new Date();
    const twoHoursAgo = new Date(now);
    twoHoursAgo.setHours(now.getHours() - 2);
    
    const logs = [
      { 
        id: '1', 
        user_id: userId, 
        event_type: 'signin', 
        timestamp: formatInTimeZone(twoHoursAgo, 'UTC', "yyyy-MM-dd'T'HH:mm:ss.SSSXXX") 
      }
    ];
    
    const metrics = calculateUserAttendanceMetrics(logs, timezone, userId);
    
    // Should be approximately 2 hours (with some seconds variation)
    expect(metrics.workTime).toBeGreaterThan(7000); // At least ~2 hours
    expect(metrics.workTime).toBeLessThan(8000); // Less than ~2.2 hours
    expect(metrics.isActive).toBe(true); // User should be considered active
  });
  
  // Test 5: Break time calculation should work correctly
  test('Break time calculation should work correctly', () => {
    const logs = [
      { id: '1', user_id: userId, event_type: 'signin', timestamp: createTodayTimestamp(9, 0) },
      { id: '2', user_id: userId, event_type: 'break_start', timestamp: createTodayTimestamp(11, 0) },
      { id: '3', user_id: userId, event_type: 'break_end', timestamp: createTodayTimestamp(11, 30) },
      { id: '4', user_id: userId, event_type: 'break_start', timestamp: createTodayTimestamp(14, 0) },
      { id: '5', user_id: userId, event_type: 'break_end', timestamp: createTodayTimestamp(14, 45) },
      { id: '6', user_id: userId, event_type: 'signout', timestamp: createTodayTimestamp(17, 0) }
    ];
    
    const metrics = calculateUserAttendanceMetrics(logs, timezone, userId);
    
    // 8 hours - 30 minutes - 45 minutes = 6 hours 45 minutes = 24300 seconds
    expect(metrics.workTime).toBe(24300);
    // 30 minutes + 45 minutes = 1 hour 15 minutes = 4500 seconds
    expect(metrics.breakTime).toBe(4500);
    expect(metrics.overtimeSeconds).toBe(0);
  });
});
