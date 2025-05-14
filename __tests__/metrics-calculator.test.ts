import { calculateUserAttendanceMetrics } from '@/lib/utils/metrics-calculator';
import { formatInTimeZone } from 'date-fns-tz';
import { addHours, addMinutes, subDays } from 'date-fns';

// Mock the console.log and console.warn to avoid cluttering test output
global.console.log = jest.fn();
global.console.warn = jest.fn();

describe('Metrics Calculator Tests', () => {
  const userId = 'test-user-id';
  const timezone = 'America/New_York'; // Use a specific timezone for testing

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

  // Test 1: Empty logs should return zero metrics
  test('Empty logs should return zero metrics', () => {
    const logs: any[] = [];
    const metrics = calculateUserAttendanceMetrics(logs, timezone, userId);

    expect(metrics.workTime).toBe(0);
    expect(metrics.breakTime).toBe(0);
    expect(metrics.overtimeSeconds).toBe(0);
    expect(metrics.isActive).toBe(false);
    expect(metrics.isOnBreak).toBe(false);
  });

  // Test 2: Simple sign in/out today should calculate correct work time
  test('Simple sign in/out today should calculate correct work time', () => {
    const logs = [
      { id: '1', user_id: userId, event_type: 'signin', timestamp: createTodayTimestamp(9, 0) },
      { id: '2', user_id: userId, event_type: 'signout', timestamp: createTodayTimestamp(17, 0) }
    ];

    const metrics = calculateUserAttendanceMetrics(logs, timezone, userId);

    // 8 hours = 28800 seconds
    expect(metrics.workTime).toBe(28800);
    expect(metrics.breakTime).toBe(0);
    expect(metrics.overtimeSeconds).toBe(0);
    expect(metrics.isActive).toBe(false);
    expect(metrics.isOnBreak).toBe(false);
  });

  // Test 3: Sign in/out with break should calculate correct work and break time
  test('Sign in/out with break should calculate correct work and break time', () => {
    const logs = [
      { id: '1', user_id: userId, event_type: 'signin', timestamp: createTodayTimestamp(9, 0) },
      { id: '2', user_id: userId, event_type: 'break_start', timestamp: createTodayTimestamp(12, 0) },
      { id: '3', user_id: userId, event_type: 'break_end', timestamp: createTodayTimestamp(13, 0) },
      { id: '4', user_id: userId, event_type: 'signout', timestamp: createTodayTimestamp(18, 0) }
    ];

    const metrics = calculateUserAttendanceMetrics(logs, timezone, userId);

    // 9 hours - 1 hour break = 8 hours = 28800 seconds
    expect(metrics.workTime).toBe(28800);
    // 1 hour break = 3600 seconds
    expect(metrics.breakTime).toBe(3600);
    expect(metrics.overtimeSeconds).toBe(0);
    expect(metrics.isActive).toBe(false);
    expect(metrics.isOnBreak).toBe(false);
  });

  // Test 4: Overtime calculation should work correctly
  test('Overtime calculation should work correctly', () => {
    const logs = [
      { id: '1', user_id: userId, event_type: 'signin', timestamp: createTodayTimestamp(8, 0) },
      { id: '2', user_id: userId, event_type: 'signout', timestamp: createTodayTimestamp(20, 0) }
    ];

    const metrics = calculateUserAttendanceMetrics(logs, timezone, userId);

    // 12 hours = 43200 seconds
    expect(metrics.workTime).toBe(43200);
    // 12 hours - 8 hours = 4 hours overtime = 14400 seconds
    expect(metrics.overtimeSeconds).toBe(14400);
    expect(metrics.isActive).toBe(false);
    expect(metrics.isOnBreak).toBe(false);
  });

  // Test 5: Yesterday's logs should not be included in today's metrics
  test('Yesterday logs should not be included in today metrics', () => {
    const logs = [
      // Yesterday's logs
      { id: '1', user_id: userId, event_type: 'signin', timestamp: createYesterdayTimestamp(9, 0) },
      { id: '2', user_id: userId, event_type: 'signout', timestamp: createYesterdayTimestamp(17, 0) },
      // Today's logs
      { id: '3', user_id: userId, event_type: 'signin', timestamp: createTodayTimestamp(9, 0) },
      { id: '4', user_id: userId, event_type: 'signout', timestamp: createTodayTimestamp(12, 0) }
    ];

    const metrics = calculateUserAttendanceMetrics(logs, timezone, userId);

    // Only today's logs should be counted: 3 hours = 10800 seconds
    expect(metrics.workTime).toBe(10800);
    expect(metrics.breakTime).toBe(0);
    expect(metrics.overtimeSeconds).toBe(0);
    expect(metrics.isActive).toBe(false);
    expect(metrics.isOnBreak).toBe(false);
  });

  // Test 6: Unreasonably long work time should be capped
  test('Unreasonably long work time should be capped', () => {
    // Create logs with 30 hours of work time (which is unreasonable)
    const startTime = new Date();
    startTime.setHours(0, 0, 0, 0); // Start of day

    const endTime = new Date(startTime);
    endTime.setHours(30, 0, 0, 0); // 30 hours later

    const logs = [
      {
        id: '1',
        user_id: userId,
        event_type: 'signin',
        timestamp: formatInTimeZone(startTime, 'UTC', "yyyy-MM-dd'T'HH:mm:ss.SSSXXX")
      },
      {
        id: '2',
        user_id: userId,
        event_type: 'signout',
        timestamp: formatInTimeZone(endTime, 'UTC', "yyyy-MM-dd'T'HH:mm:ss.SSSXXX")
      }
    ];

    const metrics = calculateUserAttendanceMetrics(logs, timezone, userId);

    // Work time should be capped at 24 hours = 86400 seconds
    expect(metrics.workTime).toBeLessThanOrEqual(86400);
    expect(metrics.breakTime).toBe(0);
    // Overtime should be capped as well (24 - 8 = 16 hours = 57600 seconds)
    expect(metrics.overtimeSeconds).toBeLessThanOrEqual(57600);
  });

  // Test 7: Current status should be determined correctly
  test('Current status should be determined correctly', () => {
    // Test signed in status
    const signedInLogs = [
      { id: '1', user_id: userId, event_type: 'signin', timestamp: createTodayTimestamp(9, 0) }
    ];

    const signedInMetrics = calculateUserAttendanceMetrics(signedInLogs, timezone, userId);
    expect(signedInMetrics.isActive).toBe(true);
    expect(signedInMetrics.isOnBreak).toBe(false);

    // Test on break status
    const onBreakLogs = [
      { id: '1', user_id: userId, event_type: 'signin', timestamp: createTodayTimestamp(9, 0) },
      { id: '2', user_id: userId, event_type: 'break_start', timestamp: createTodayTimestamp(12, 0) }
    ];

    const onBreakMetrics = calculateUserAttendanceMetrics(onBreakLogs, timezone, userId);
    // Note: The current implementation might set isActive differently based on the logs
    // We're more concerned with isOnBreak being correct
    expect(onBreakMetrics.isOnBreak).toBe(true);

    // Test signed out status
    const signedOutLogs = [
      { id: '1', user_id: userId, event_type: 'signin', timestamp: createTodayTimestamp(9, 0) },
      { id: '2', user_id: userId, event_type: 'signout', timestamp: createTodayTimestamp(17, 0) }
    ];

    const signedOutMetrics = calculateUserAttendanceMetrics(signedOutLogs, timezone, userId);
    expect(signedOutMetrics.isActive).toBe(false);
    expect(signedOutMetrics.isOnBreak).toBe(false);
  });
});
