'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { toast } from 'sonner';
import { Database } from '@/lib/supabase/database.types';
import { calculateUserAttendanceMetrics, AttendanceMetrics } from '@/lib/utils/metrics-calculator';
import { determineUserStatus, getLastActivity } from '@/lib/utils/statusDetermination';

type AttendanceLog = Database['public']['Tables']['attendance_logs']['Row'];

interface AttendanceContextType {
  logs: AttendanceLog[];
  metrics: AttendanceMetrics;
  isLoading: boolean;
  lastUpdateTime: Date | null;
  isRealTimeEnabled: boolean;
  toggleRealTimeUpdates: () => void;
  refreshData: () => Promise<void>;
  formatDuration: (seconds: number) => string;
}

const defaultMetrics: AttendanceMetrics = {
  userId: '',
  workTime: 0,
  breakTime: 0,
  overtimeSeconds: 0,
  isActive: false,
  isOnBreak: false,
  lastActivity: null,
  weekTime: 0,
  monthTime: 0
};

const AttendanceContext = createContext<AttendanceContextType>({
  logs: [],
  metrics: defaultMetrics,
  isLoading: true,
  lastUpdateTime: null,
  isRealTimeEnabled: true,
  toggleRealTimeUpdates: () => {},
  refreshData: async () => {},
  formatDuration: (seconds) => '0m',
});

export const useAttendance = () => useContext(AttendanceContext);

// Format duration helper
const formatDuration = (seconds: number): string => {
  if (seconds < 0) seconds = 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${minutes}m`;
};

interface AttendanceProviderProps {
  children: ReactNode;
  initialLogs?: AttendanceLog[];
  initialMetrics?: AttendanceMetrics | null;
  userId: string;
  timezone: string;
}

export const AttendanceProvider: React.FC<AttendanceProviderProps> = ({
  children,
  initialLogs = [],
  initialMetrics = null,
  userId,
  timezone,
}) => {
  const [logs, setLogs] = useState<AttendanceLog[]>(initialLogs);
  const [metrics, setMetrics] = useState<AttendanceMetrics>(initialMetrics || defaultMetrics);
  const [isLoading, setIsLoading] = useState(false);
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(true);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(new Date());
  const [isClient, setIsClient] = useState(false);

  // Set client-side flag and initialize data
  useEffect(() => {
    setIsClient(true);

    // If we have initialMetrics, use them
    if (initialMetrics) {
      console.log('Using server-provided initial metrics:', initialMetrics);
      setMetrics(initialMetrics);
      setLastUpdateTime(new Date());
    } else {
      // Otherwise, fetch data on client-side
      const loadInitialData = async () => {
        try {
          console.log('No initial metrics provided, fetching from client-side');
          await refreshData();
          console.log('Client-side metrics refreshed successfully');
        } catch (error) {
          console.error('Error refreshing initial data:', error);
        }
      };

      loadInitialData();
    }
  }, [initialMetrics]);

  // Set up real-time subscription
  useEffect(() => {
    if (!isClient || !isRealTimeEnabled || !userId) return;

    const supabase = createClient();

    console.log('Setting up real-time subscription for user:', userId);

    // Subscribe to attendance_logs table changes for this user
    const subscription = supabase
      .channel('user-attendance-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'attendance_logs',
        filter: `user_id=eq.${userId}`
      }, async (payload) => {
        console.log('Real-time attendance update received:', payload);

        try {
          // Fetch updated data
          await refreshData();
          console.log('Data refreshed after real-time update');
          setLastUpdateTime(new Date());
        } catch (error) {
          console.error('Error refreshing attendance data:', error);
          toast.error('Failed to update attendance data');
        }
      })
      .subscribe();

    // Refresh data every 2 minutes as a fallback
    const intervalId = setInterval(async () => {
      if (isRealTimeEnabled) {
        try {
          await refreshData();
          console.log('Data refreshed by interval timer');
          setLastUpdateTime(new Date());
        } catch (error) {
          console.error('Error in scheduled attendance refresh:', error);
        }
      }
    }, 2 * 60 * 1000);

    // Cleanup function
    return () => {
      console.log('Cleaning up real-time subscription');
      supabase.removeChannel(subscription);
      clearInterval(intervalId);
    };
  }, [isClient, isRealTimeEnabled, userId]);

  // Function to refresh attendance data
  const refreshData = async () => {
    if (!userId) {
      console.warn('Cannot refresh data: No user ID provided');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Refreshing attendance data for user:', userId);

      // Fetch ALL logs from Supabase for this user (not just today's)
      const supabase = createClient();
      const { data: newLogs, error: logsError } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: true });

      if (logsError) {
        console.error('Error fetching logs:', logsError);
        throw logsError;
      }

      console.log(`Fetched ${newLogs?.length || 0} attendance logs`);

      if (newLogs) {
        setLogs(newLogs);
      }

      // Calculate metrics directly instead of using the API
      const metricsData = calculateUserAttendanceMetrics(newLogs || [], timezone, userId);

      // Log detailed metrics information for debugging
      console.log('Calculated metrics:', {
        workTime: `${Math.floor(metricsData.workTime/3600)}h ${Math.floor((metricsData.workTime%3600)/60)}m`,
        breakTime: `${Math.floor(metricsData.breakTime/3600)}h ${Math.floor((metricsData.breakTime%3600)/60)}m`,
        overtimeSeconds: `${Math.floor(metricsData.overtimeSeconds/3600)}h ${Math.floor((metricsData.overtimeSeconds%3600)/60)}m`,
        weekTime: `${Math.floor(metricsData.weekTime/3600)}h ${Math.floor((metricsData.weekTime%3600)/60)}m`,
        monthTime: `${Math.floor(metricsData.monthTime/3600)}h ${Math.floor((metricsData.monthTime%3600)/60)}m`,
        isActive: metricsData.isActive,
        isOnBreak: metricsData.isOnBreak
      });

      // Validate metrics before setting them
      const MAX_REASONABLE_HOURS = 24; // Maximum reasonable hours for a day
      const MAX_REASONABLE_SECONDS = MAX_REASONABLE_HOURS * 3600;

      // Check if work time is unreasonably high
      if (metricsData.workTime > MAX_REASONABLE_SECONDS) {
        console.error(`Unreasonable work time detected: ${Math.floor(metricsData.workTime/3600)}h. Capping to ${MAX_REASONABLE_HOURS}h.`);
        metricsData.workTime = MAX_REASONABLE_SECONDS;
        metricsData.overtimeSeconds = Math.max(0, metricsData.workTime - (8 * 3600));
      }

      setMetrics(metricsData);
      setLastUpdateTime(new Date());

      return metricsData; // Return the metrics for potential use by the caller
    } catch (error) {
      console.error('Error refreshing attendance data:', error);
      toast.error('Failed to update attendance data');
      throw error; // Re-throw to allow caller to handle
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle real-time updates
  const toggleRealTimeUpdates = () => {
    setIsRealTimeEnabled(prev => !prev);
    toast.info(isRealTimeEnabled ? 'Real-time updates disabled' : 'Real-time updates enabled');
  };

  return (
    <AttendanceContext.Provider
      value={{
        logs,
        metrics,
        isLoading,
        lastUpdateTime,
        isRealTimeEnabled,
        toggleRealTimeUpdates,
        refreshData,
        formatDuration,
      }}
    >
      {children}
    </AttendanceContext.Provider>
  );
};
