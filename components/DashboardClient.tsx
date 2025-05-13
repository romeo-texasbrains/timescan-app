"use client";
import { format, isSameDay, startOfDay, parseISO } from "date-fns";
import { formatInTimeZone } from 'date-fns-tz'; // Import timezone formatter
import { capShiftDuration, MAX_SHIFT_DURATION_SECONDS } from "@/lib/shift-utils"; // Import shift utilities
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import clsx from 'clsx';
import { Database } from "@/lib/supabase/database.types"; // Import database types
import { useState, useContext, useEffect, useRef } from "react"; // Import useState, useContext, useEffect and useRef
import { useRouter } from 'next/navigation'; // Import for page refresh
import dynamic from 'next/dynamic'; // Import dynamic
import { useTimezone } from '@/context/TimezoneContext'; // Correctly import the hook
import { useMediaQuery } from '@/hooks/useMediaQuery'; // Import useMediaQuery hook
import { useAttendance } from '@/context/AttendanceContext'; // Import the attendance context hook
import { determineUserStatus, getLastActivity } from '@/lib/utils/statusDetermination';
import {
  ResponsiveTable,
  ResponsiveTableHeader,
  ResponsiveTableBody,
  ResponsiveTableHead,
  ResponsiveTableRow,
  ResponsiveTableCell,
  ResponsiveTableCaption
} from '@/components/ui/responsive-table'; // Import responsive table components

// Create client-only components for time display to avoid hydration errors
const ClientOnlyTimeDisplay = dynamic(() =>
  Promise.resolve(({ seconds }: { seconds: number }) => {
    // Format the time in a single line
    return (
      <span className="text-xl font-bold text-foreground">
        {formatDuration(seconds)}
      </span>
    );
  }),
  { ssr: false }
);

// Client-only component for break time display
const ClientOnlyBreakDisplay = dynamic(() =>
  Promise.resolve(({ seconds }: { seconds: number }) => (
    <span className="text-sm font-semibold text-foreground">{formatDuration(seconds)}</span>
  )),
  { ssr: false }
);

// Client-only component for overtime display
const ClientOnlyOvertimeDisplay = dynamic(() =>
  Promise.resolve(({ seconds }: { seconds: number }) => (
    <span className="text-sm font-semibold text-foreground">{formatDuration(seconds)}</span>
  )),
  { ssr: false }
);

// Client-only component for break duration in dialog
const ClientOnlyBreakDuration = dynamic(() =>
  Promise.resolve(({ startTime, currentTime }: { startTime: Date | null, currentTime: Date }) => {
    if (!startTime) return <span>ongoing</span>;
    const durationSecs = (currentTime.getTime() - startTime.getTime()) / 1000;
    return <span>{formatDuration(durationSecs)}</span>;
  }),
  { ssr: false }
);

// Client-only component for work duration in punch out dialog
const ClientOnlyWorkDuration = dynamic(() =>
  Promise.resolve(({ seconds }: { seconds: number }) => (
    <span className="font-semibold text-primary">{formatDuration(seconds)}</span>
  )),
  { ssr: false }
);

// Client-only components for table cell durations
const ClientOnlyProductionTime = dynamic(() =>
  Promise.resolve(({ startLog, endLog }: { startLog: AttendanceLog, endLog: AttendanceLog }) => (
    <span className="text-foreground">{formatDuration(calculateDuration(startLog, endLog))}</span>
  )),
  { ssr: false }
);

const ClientOnlyBreakTime = dynamic(() =>
  Promise.resolve(({ seconds }: { seconds: number }) => (
    <span className="px-2 py-1 rounded-full text-xs bg-primary/10 text-foreground">
      {formatDuration(seconds)}
    </span>
  )),
  { ssr: false }
);

const ClientOnlyOvertimeTime = dynamic(() =>
  Promise.resolve(({ seconds }: { seconds: number }) => (
    <span className="px-2 py-1 rounded-full text-xs bg-green-500/10 text-green-500 font-medium">
      {formatDuration(seconds)}
    </span>
  )),
  { ssr: false }
);

// Client-only component for progress bars
const ClientOnlyProgressBar = dynamic(() =>
  Promise.resolve(({ percentage, colorClass }: { percentage: number, colorClass: string }) => {
    // Fix the percentage to 2 decimal places
    const fixedPercentage = percentage.toFixed(2);
    return (
      <div
        className={`h-full rounded-full transition-all duration-500 ease-out ${colorClass}`}
        style={{ width: `${fixedPercentage}%` }}
      />
    );
  }),
  { ssr: false }
);
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"; // Import AlertDialog components

type AttendanceLog = Database['public']['Tables']['attendance_logs']['Row'];

// Helper function to calculate duration between two logs in seconds with capping
function calculateDuration(startLog: AttendanceLog, endLog: AttendanceLog): number {
  if (!startLog?.timestamp || !endLog?.timestamp) return 0;
  const startTime = new Date(startLog.timestamp).getTime();
  const endTime = new Date(endLog.timestamp).getTime();

  // Ensure end time is after start time
  if (endTime <= startTime) return 0;

  // Apply capping to prevent unreasonably long durations
  const { durationSeconds } = capShiftDuration(startTime, endTime);
  return durationSeconds;
}

// --- New Duration Formatting Helpers ---
function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 0) totalSeconds = 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours}hr`);
  }
  if (minutes > 0 || (hours > 0 && seconds >= 0)) { // Show minutes if hours exist or if minutes>0
    parts.push(`${minutes}min`);
  }
   // Always show seconds if total duration is < 1 min, or if hours/minutes are shown
  if (seconds >= 0 && (hours > 0 || minutes > 0 || totalSeconds < 60)) {
       parts.push(`${seconds}sec`);
  }

  // If totalSeconds is exactly 0, parts might be empty, so ensure "0sec"
  if (parts.length === 0) {
        return '0sec';
   }

  return parts.join(' ');
}

// Simpler tooltip format function
function formatDurationTooltip(totalSeconds: number): string {
    if (totalSeconds < 0) totalSeconds = 0;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
        return `${minutes}m`;
    } else {
        return `${Math.floor(totalSeconds)}s`;
    }
}
// --- End New Helpers ---

// --- Dynamic Wrapper for Pie Chart ---
const DynamicPieChartComponent = dynamic(() => Promise.resolve(InnerPieChart), {
  ssr: false,
  loading: () => <div style={{ width: 160, height: 160 }} className="flex items-center justify-center text-sm text-gray-500">Loading chart...</div>, // Optional loading state
});

function InnerPieChart({ todaySecs }: { todaySecs: number }) {
  const data = [
    { value: Math.max(0, todaySecs / 3600) },
    { value: Math.max(0, 8 - (todaySecs / 3600)) }
  ];
  // Use theme colors: primary and muted/accent
  const COLORS = ['var(--color-primary)', 'var(--color-muted)'];

  return (
    <div style={{ width: 160, height: 160 }} className="relative">
      {/* Add a subtle glow effect behind the chart */}
      <div className="absolute inset-0 rounded-full bg-primary/10 blur-md"></div>

      <PieChart width={160} height={160}>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={70}
          dataKey="value"
          startAngle={90}
          endAngle={-270}
          paddingAngle={0} // No padding needed for 2 segments
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[index % COLORS.length]}
              stroke={COLORS[index % COLORS.length]}
              strokeWidth={1}
            />
          ))}
        </Pie>
      </PieChart>
    </div>
  );
}
// --- End Dynamic Wrapper ---

// Helper function for StatBar colors (using new theme variables)
const getStatBarColor = (label: string): string => {
  switch (label.toLowerCase()) {
    case 'today': return 'bg-primary'; // Use primary color
    case 'this week': return 'bg-chart-2'; // Use a chart color
    case 'this month': return 'bg-chart-3'; // Use another chart color
    case 'remaining': return 'bg-muted'; // Use muted background
    case 'overtime': return 'bg-destructive'; // Use destructive color
    default: return 'bg-accent'; // Fallback
  }
};

export default function DashboardClient({
  userProfile,
  departmentName,
  timezone: serverTimezone
}: {
  userProfile: { full_name: string; role: string; department_id: string | null } | null;
  departmentName: string | null;
  timezone: string;
}) { // Use AttendanceLog type
  const router = useRouter(); // Get router instance
  const { timezone: contextTimezone } = useTimezone(); // Use the hook to get timezone
  const {
    logs,
    metrics,
    isLoading,
    lastUpdateTime,
    isRealTimeEnabled,
    toggleRealTimeUpdates,
    refreshData,
    formatDuration
  } = useAttendance(); // Use the attendance context

  // Use server-provided timezone as the source of truth, fallback to context
  const timezone = serverTimezone || contextTimezone;
  // State for punch out action
  const [punchStatus, setPunchStatus] = useState<{ loading: boolean; message: string; error: boolean }>({ loading: false, message: '', error: false });
  // State for real-time clock
  const [currentTime, setCurrentTime] = useState(new Date());
  // State for dialog visibility (though AlertDialog handles its own state via Trigger)
  // We might need explicit state if triggering programmatically later

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000); // Update every second
    return () => clearInterval(interval); // Cleanup on unmount
  }, []); // Empty dependency array ensures this runs only once on mount

  // Use metrics from the context
  const now = currentTime; // Use state variable for current time
  const todayStart = startOfDay(now);
  const weekStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay())); // Start of week (Sunday)
  const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)); // Start of month

  // Get metrics directly from the context
  let todaySecs = metrics.workTime;
  let weekSecs = metrics.weekTime;
  let monthSecs = metrics.monthTime;
  let breakTimeSecs = metrics.breakTime;
  let overtimeSecs = metrics.overtimeSeconds;
  const isCurrentlySignedIn = metrics.isActive;
  const isOnBreak = metrics.isOnBreak;

  // Add state for real-time counters
  const [realTimeWorkSecs, setRealTimeWorkSecs] = useState(todaySecs);
  const [realTimeBreakSecs, setRealTimeBreakSecs] = useState(breakTimeSecs);

  // Update real-time counters every second if user is active or on break
  useEffect(() => {
    // Initialize with values from metrics
    setRealTimeWorkSecs(metrics.workTime);
    setRealTimeBreakSecs(metrics.breakTime);

    console.log('Real-time counter effect triggered. Status:',
      isCurrentlySignedIn ? 'Signed In' : 'Signed Out',
      isOnBreak ? 'On Break' : 'Not on Break',
      'Real-time enabled:', isRealTimeEnabled);

    // Only increment counters if real-time updates are enabled
    if (!isRealTimeEnabled) return;

    const interval = setInterval(() => {
      // If user is signed in and not on break, increment work time
      if (isCurrentlySignedIn && !isOnBreak) {
        setRealTimeWorkSecs(prev => prev + 1);
      }

      // If user is on break, increment break time
      if (isOnBreak) {
        setRealTimeBreakSecs(prev => prev + 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [metrics, isCurrentlySignedIn, isOnBreak, isRealTimeEnabled]);

  // Reset real-time counters when metrics change
  useEffect(() => {
    setRealTimeWorkSecs(metrics.workTime);
    setRealTimeBreakSecs(metrics.breakTime);
    console.log('Metrics changed, resetting real-time counters to:', {
      workTime: `${Math.floor(metrics.workTime/3600)}h ${Math.floor((metrics.workTime%3600)/60)}m ${metrics.workTime % 60}s`,
      breakTime: `${Math.floor(metrics.breakTime/3600)}h ${Math.floor((metrics.breakTime%3600)/60)}m ${metrics.breakTime % 60}s`
    });
  }, [metrics.workTime, metrics.breakTime]);

  // Create a local state variable for tracking break status that we can modify
  // Initialize with isOnBreak but don't create a dependency that could cause infinite loops
  const [localBreakStatus, setLocalBreakStatus] = useState(false);

  // Sync local break status with context when context changes
  // Use a ref to track if this is the first render to avoid infinite loops
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      setLocalBreakStatus(isOnBreak);
      isFirstRender.current = false;
    }
  }, [isOnBreak]);

  // For attendance records display
  let dailyMap: Record<string, number> = {};
  let attendancePairs: { in: AttendanceLog, out: AttendanceLog | null, breakTime?: number, overtime?: number }[] = [];

  // Create nowInTimezone at the top level so it's available to all functions
  let nowInTimezone = new Date(formatInTimeZone(now, timezone, 'yyyy-MM-dd HH:mm:ss'));

  // Process logs to find pairs and calculate durations
  const sortedLogs = (logs || []).sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
  let processedIndices = new Set<number>();

  // Use timezone when calculating date strings for grouping if needed
  const dateStrToTimezone = (date: Date) => {
      try {
        return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
      } catch { return 'invalid-date'; } // Handle potential errors
  };

  // First pass: collect all break periods using a functional approach to avoid mutation issues

  // Define our types
  type BreakPeriod = { start: AttendanceLog, end: AttendanceLog | null };
  type TimePeriod = { start: Date, end: Date };

  // Function to process logs and extract break periods
  const processBreakPeriods = () => {
    const result: {
      breakPeriods: BreakPeriod[],
      breakTimePeriods: TimePeriod[],
      isCurrentlyOnBreak: boolean,
      lastBreakStartLog: AttendanceLog | null
    } = {
      breakPeriods: [],
      breakTimePeriods: [],
      isCurrentlyOnBreak: false,
      lastBreakStartLog: null
    };

    let lastBreakStartTimestamp: Date | null = null;

    // Create a new Set for processed indices to avoid modifying the outer one yet
    const localProcessedIndices = new Set<number>();

    // First pass to find break periods
    for (let i = 0; i < sortedLogs.length; i++) {
      const currentLog = sortedLogs[i];
      if (!currentLog.timestamp) continue;

      const timestamp = new Date(currentLog.timestamp);
      const timestampInTimezone = new Date(formatInTimeZone(timestamp, timezone, 'yyyy-MM-dd HH:mm:ss'));

      if (currentLog.event_type === 'break_start') {
        lastBreakStartTimestamp = timestampInTimezone;
        let foundBreakEnd = false;

        // Look for matching break_end
        for (let j = i + 1; j < sortedLogs.length; j++) {
          const nextLog = sortedLogs[j];
          if (nextLog.event_type === 'break_end' && nextLog.timestamp) {
            const nextTimestamp = new Date(nextLog.timestamp);
            const nextTimestampInTimezone = new Date(formatInTimeZone(nextTimestamp, timezone, 'yyyy-MM-dd HH:mm:ss'));

            // Add to time periods
            result.breakTimePeriods.push({
              start: timestampInTimezone,
              end: nextTimestampInTimezone
            });

            // Add to break periods
            result.breakPeriods.push({
              start: currentLog,
              end: nextLog
            });

            // Mark as processed
            localProcessedIndices.add(i);
            localProcessedIndices.add(j);

            lastBreakStartTimestamp = null;
            foundBreakEnd = true;
            break;
          }
        }

        // Handle unpaired break_start
        if (!foundBreakEnd) {
          result.breakPeriods.push({
            start: currentLog,
            end: null
          });

          localProcessedIndices.add(i);

          // If this is the last event, user is currently on break
          if (i === sortedLogs.length - 1) {
            result.isCurrentlyOnBreak = true;
            result.lastBreakStartLog = currentLog;
          }
        }
      }
    }

    // Add all processed indices to the outer set
    localProcessedIndices.forEach(index => processedIndices.add(index));

    // Close any open break period with current time
    // Use the outer nowInTimezone variable
    if (lastBreakStartTimestamp) {
      result.breakTimePeriods.push({
        start: lastBreakStartTimestamp,
        end: nowInTimezone
      });
    }

    return result;
  };

  // Process break periods
  const { breakPeriods, breakTimePeriods, isCurrentlyOnBreak, lastBreakStartLog } = processBreakPeriods();

  // Update local break status if needed - using useEffect to avoid infinite renders
  useEffect(() => {
    if (isCurrentlyOnBreak) {
      setLocalBreakStatus(true);
    }
  }, [isCurrentlyOnBreak]);

  // Calculate total break time using the same approach as manager dashboard
  const calculateTotalSeconds = (periods: TimePeriod[]): number => {
    return periods.reduce((total, period) => {
      const seconds = (period.end.getTime() - period.start.getTime()) / 1000;
      // Ensure we don't add negative values
      return total + Math.max(0, seconds);
    }, 0);
  };

  // We're using the metrics from the context for break time
  // Just ensure it's capped to a reasonable maximum
  breakTimeSecs = metrics.breakTime; // Use context breakTime directly
  if (breakTimeSecs > MAX_SHIFT_DURATION_SECONDS) {
    breakTimeSecs = MAX_SHIFT_DURATION_SECONDS;
  }

  // nowInTimezone is already declared at the top level

  // Process signin/signout pairs using a functional approach
  const processActivePeriods = () => {
    const result: {
      activePeriods: TimePeriod[],
      attendancePairs: { in: AttendanceLog, out: AttendanceLog | null, breakTime?: number, overtime?: number }[],
      dailyMap: Record<string, number>,
      todaySecs: number,
      weekSecs: number,
      monthSecs: number,
      overtimeSecs: number
    } = {
      activePeriods: [],
      attendancePairs: [],
      dailyMap: {},
      todaySecs: 0,
      weekSecs: 0,
      monthSecs: 0,
      overtimeSecs: 0
    };

    let lastActiveStartTimestamp: Date | null = null;

    // Create a new Set for processed indices to avoid modifying the outer one
    const localProcessedIndices = new Set<number>(processedIndices);

    // Process signin/signout pairs
    for (let i = 0; i < sortedLogs.length; i++) {
      if (localProcessedIndices.has(i)) continue; // Skip if already processed

      const currentLog = sortedLogs[i];
      if (!currentLog.timestamp) continue;

      const timestamp = new Date(currentLog.timestamp);
      const timestampInTimezone = new Date(formatInTimeZone(timestamp, timezone, 'yyyy-MM-dd HH:mm:ss'));

      if (currentLog.event_type === 'signin') {
        // Store the active start timestamp
        lastActiveStartTimestamp = timestampInTimezone;

        let foundPair = false;

        // Look for the next signout
        for (let j = i + 1; j < sortedLogs.length; j++) {
          if (localProcessedIndices.has(j)) continue; // Skip if already paired

          const nextLog = sortedLogs[j];
          if (nextLog.event_type === 'signout' && nextLog.timestamp) {
            const nextTimestamp = new Date(nextLog.timestamp);
            const nextTimestampInTimezone = new Date(formatInTimeZone(nextTimestamp, timezone, 'yyyy-MM-dd HH:mm:ss'));

            // Add to active periods
            if (lastActiveStartTimestamp) {
              result.activePeriods.push({
                start: lastActiveStartTimestamp,
                end: nextTimestampInTimezone
              });
              lastActiveStartTimestamp = null;
            }

            // Calculate duration
            const duration = calculateDuration(currentLog, nextLog);

            // Use the timestamp in timezone for date calculations
            const logDate = startOfDay(timestampInTimezone);
            const dateStr = formatInTimeZone(logDate, timezone, 'yyyy-MM-dd');

            // Calculate overtime
            const standardWorkdaySecs = 8 * 3600; // 8 hours in seconds
            const pairOvertimeSecs = Math.max(0, duration - standardWorkdaySecs);

            // Add duration to totals
            const todayDateStr = formatInTimeZone(todayStart, timezone, 'yyyy-MM-dd');
            const logDateStr = formatInTimeZone(logDate, timezone, 'yyyy-MM-dd');

            if (logDateStr === todayDateStr) {
              result.todaySecs += duration;
              result.overtimeSecs += pairOvertimeSecs;
            }

            // For week and month
            if (logDate >= weekStart) result.weekSecs += duration;
            if (logDate >= monthStart) result.monthSecs += duration;

            // Store in daily map
            result.dailyMap[dateStr] = (result.dailyMap[dateStr] || 0) + duration;

            // Find break periods within this signin/signout pair
            const pairBreakSecs = breakPeriods
              .filter(bp =>
                bp.start.timestamp && bp.end?.timestamp &&
                new Date(bp.start.timestamp).getTime() >= new Date(currentLog.timestamp || 0).getTime() &&
                new Date(bp.end.timestamp).getTime() <= new Date(nextLog.timestamp || 0).getTime()
              )
              .reduce((total, bp) => total + calculateDuration(bp.start, bp.end!), 0);

            // Add to attendance pairs
            result.attendancePairs.push({
              in: currentLog,
              out: nextLog,
              overtime: pairOvertimeSecs,
              breakTime: pairBreakSecs > 0 ? pairBreakSecs : undefined
            });

            localProcessedIndices.add(i);
            localProcessedIndices.add(j);
            foundPair = true;
            break;
          }
        }

        // Handle unpaired signin
        if (!foundPair) {
          result.attendancePairs.push({ in: currentLog, out: null });
          localProcessedIndices.add(i);
        }
      } else if (currentLog.event_type === 'signout') {
        // Handle potential signout without preceding signin
        localProcessedIndices.add(i);
        lastActiveStartTimestamp = null;
      }
    }

    // Close any open active period with current time
    if (lastActiveStartTimestamp) {
      result.activePeriods.push({
        start: lastActiveStartTimestamp,
        end: nowInTimezone
      });
    }

    // Add all processed indices to the outer set
    localProcessedIndices.forEach(index => processedIndices.add(index));

    return result;
  };

  // Process active periods
  const {
    attendancePairs: processedAttendancePairs,
    dailyMap: processedDailyMap,
    todaySecs: processedTodaySecs,
    weekSecs: processedWeekSecs,
    monthSecs: processedMonthSecs,
    overtimeSecs: processedOvertimeSecs
  } = processActivePeriods();

  // Update our variables with the processed results for attendance pairs and daily map
  attendancePairs = processedAttendancePairs;
  dailyMap = processedDailyMap;

  // IMPORTANT: Use the metrics from the context for today's time, not our own calculation
  // This ensures consistency with the manager dashboard
  // todaySecs = processedTodaySecs; // Don't use our own calculation
  // weekSecs = processedWeekSecs; // Don't use our own calculation
  // monthSecs = processedMonthSecs; // Don't use our own calculation
  // overtimeSecs = processedOvertimeSecs; // Don't use our own calculation

  // We're using the metrics from the context, so we don't need to recalculate
  // Just ensure our values are capped appropriately
  console.log('Using metrics from context - workTime:', metrics.workTime, 'breakTime:', metrics.breakTime);

  // Cap all durations to reasonable maximums
  if (todaySecs > MAX_SHIFT_DURATION_SECONDS) todaySecs = MAX_SHIFT_DURATION_SECONDS;
  if (weekSecs > (MAX_SHIFT_DURATION_SECONDS * 7)) weekSecs = MAX_SHIFT_DURATION_SECONDS * 7;
  if (monthSecs > (MAX_SHIFT_DURATION_SECONDS * 31)) monthSecs = MAX_SHIFT_DURATION_SECONDS * 31;

  const dailyData = Object.entries(dailyMap)
    .map(([date, secs]) => ({ date, hours: +(secs / 3600).toFixed(2) }))
    .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort daily data for chart

  // Use our utility function to determine the user's status
  const userStatus = determineUserStatus(sortedLogs);

  // Override the context values with our utility function values for consistency
  const isCurrentlySignedInActual = userStatus === 'signed_in';
  const isOnBreakActual = userStatus === 'on_break';

  // Add a useEffect to log the current sign-in state for debugging
  useEffect(() => {
    console.log('Current sign-in state (from context):', isCurrentlySignedIn ? 'Signed In' : 'Signed Out');
    console.log('Current sign-in state (from utility):', userStatus);
    console.log('Current break state (from context):', isOnBreak ? 'On Break' : 'Not on Break');
    console.log('Current break state (local):', localBreakStatus ? 'On Break' : 'Not on Break');
    console.log('Last log event type:', sortedLogs.length > 0 ? sortedLogs[sortedLogs.length - 1].event_type : 'None');

    // Log time metrics for debugging
    console.log('Time metrics from context:', {
      workTime: `${Math.floor(metrics.workTime/3600)}h ${Math.floor((metrics.workTime%3600)/60)}m`,
      breakTime: `${Math.floor(metrics.breakTime/3600)}h ${Math.floor((metrics.breakTime%3600)/60)}m`,
      weekTime: `${Math.floor(metrics.weekTime/3600)}h ${Math.floor((metrics.weekTime%3600)/60)}m`,
      monthTime: `${Math.floor(metrics.monthTime/3600)}h ${Math.floor((metrics.monthTime%3600)/60)}m`,
    });

    console.log('Time metrics from local calculation:', {
      todaySecs: `${Math.floor(processedTodaySecs/3600)}h ${Math.floor((processedTodaySecs%3600)/60)}m`,
      breakTimeSecs: `${Math.floor(breakTimeSecs/3600)}h ${Math.floor((breakTimeSecs%3600)/60)}m`,
      weekSecs: `${Math.floor(processedWeekSecs/3600)}h ${Math.floor((processedWeekSecs%3600)/60)}m`,
      monthSecs: `${Math.floor(processedMonthSecs/3600)}h ${Math.floor((processedMonthSecs%3600)/60)}m`,
    });

    // Log any discrepancies between context and utility function
    if ((userStatus === 'signed_in' && !isCurrentlySignedIn) ||
        (userStatus === 'signed_out' && isCurrentlySignedIn) ||
        (userStatus === 'on_break' && !isOnBreak)) {
      console.warn('Status discrepancy detected between context and utility function!');
    }
  }, [isCurrentlySignedIn, isOnBreak, localBreakStatus, sortedLogs, userStatus, metrics, processedTodaySecs, breakTimeSecs, processedWeekSecs, processedMonthSecs]);

  // Use real-time counters for active display, but keep metrics for consistency with manager dashboard
  // This ensures the timer updates in real-time while still being consistent with the server
  const finalTodaySecs = isRealTimeEnabled ? realTimeWorkSecs : metrics.workTime;
  const finalWeekSecs = metrics.weekTime; // Use context weekTime
  const finalMonthSecs = metrics.monthTime; // Use context monthTime
  // Keep using the context value for overtime
  overtimeSecs = metrics.overtimeSeconds;
  // Use real-time break counter
  const finalBreakSecs = isRealTimeEnabled ? realTimeBreakSecs : metrics.breakTime;

  // Calculate decimal hours for components expecting numbers
  const finalTodayHrsDecimal = finalTodaySecs / 3600;
  const weekHrsDecimal = finalWeekSecs / 3600;
  const monthHrsDecimal = finalMonthSecs / 3600;

  console.log('Final time values used for display:', {
    finalTodaySecs: `${Math.floor(finalTodaySecs/3600)}h ${Math.floor((finalTodaySecs%3600)/60)}m ${finalTodaySecs % 60}s`,
    finalWeekSecs: `${Math.floor(finalWeekSecs/3600)}h ${Math.floor((finalWeekSecs%3600)/60)}m`,
    finalMonthSecs: `${Math.floor(finalMonthSecs/3600)}h ${Math.floor((finalMonthSecs%3600)/60)}m`,
    overtimeSecs: `${Math.floor(overtimeSecs/3600)}h ${Math.floor((overtimeSecs%3600)/60)}m`,
    finalBreakSecs: `${Math.floor(finalBreakSecs/3600)}h ${Math.floor((finalBreakSecs%3600)/60)}m ${finalBreakSecs % 60}s`,
  });

  // Log real-time counters
  console.log('Real-time counters:', {
    realTimeWorkSecs: `${Math.floor(realTimeWorkSecs/3600)}h ${Math.floor((realTimeWorkSecs%3600)/60)}m ${realTimeWorkSecs % 60}s`,
    realTimeBreakSecs: `${Math.floor(realTimeBreakSecs/3600)}h ${Math.floor((realTimeBreakSecs%3600)/60)}m ${realTimeBreakSecs % 60}s`,
    isRealTimeEnabled
  });

  // --- Formatting Outputs ---
  const formatTime = (date: Date | string | number | null | undefined) => {
      if (!date) return '--:--';
      try {
          return formatInTimeZone(new Date(date), timezone, 'h:mm a');
      } catch { return 'Invalid Date' }
  }
  const formatDate = (date: Date | string | number | null | undefined) => {
      if (!date) return '----------';
       try {
          return formatInTimeZone(new Date(date), timezone, 'PP'); // e.g., Jan 1, 2024
      } catch { return 'Invalid Date' }
  }
  const formatFullDate = (date: Date | string | number | null | undefined) => {
       if (!date) return '----------';
       try {
           return formatInTimeZone(new Date(date), timezone, 'PPPP'); // e.g., Wednesday, January 1st, 2024
      } catch { return 'Invalid Date' }
  }

  // --- Punch Out Handler ---
  const handlePunchOut = async () => {
    setPunchStatus({ loading: true, message: 'Processing punch out...', error: false });
    try {
      // Log the current state before attempting to punch out
      console.log('Attempting to punch out. Current state:',
        isCurrentlySignedIn ? 'Signed In' : 'Signed Out',
        'Last log event:', sortedLogs.length > 0 ? sortedLogs[sortedLogs.length - 1].event_type : 'None');

      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send placeholder data - API validation allows non-empty string
        body: JSON.stringify({ qrCodeData: 'TIMESCAN-LOC:manual_dashboard_punch' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      console.log('Punch out API response:', data);

      setPunchStatus({
        loading: false,
        message: `${data.message || 'Punch out successful!'} Page will refresh in a moment...`,
        error: false
      });

      // Show success message for 2 seconds before refreshing to ensure the server has time to process
      setTimeout(async () => {
        console.log('Refreshing data after punch out...');
        try {
          // Refresh data using the context
          await refreshData();
          // No need for a full page reload anymore
          setPunchStatus({
            loading: false,
            message: 'Punch out successful! Data refreshed.',
            error: false
          });
        } catch (error) {
          console.error('Error refreshing data after punch out:', error);
          // Fall back to page reload if refresh fails
          window.location.href = '/?t=' + new Date().getTime(); // Add timestamp to prevent caching
        }
      }, 2000);
    } catch (error: any) {
      console.error("Punch out error:", error);

      // Check if the error is about not being signed in
      const errorMessage = error.message || 'Could not process punch out.';
      const isSignInError = errorMessage.toLowerCase().includes('not currently signed in');

      if (isSignInError) {
        // If there's a mismatch between UI and server state, show a special message
        setPunchStatus({
          loading: false,
          message: `Error: ${errorMessage} The page will refresh to update your status.`,
          error: true
        });

        // Refresh data after 2 seconds to sync the UI with the server
        setTimeout(async () => {
          try {
            // Refresh data using the context
            await refreshData();
            setPunchStatus({
              loading: false,
              message: 'Status updated. Data refreshed.',
              error: false
            });
          } catch (error) {
            console.error('Error refreshing data after status mismatch:', error);
            // Fall back to page reload if refresh fails
            window.location.reload();
          }
        }, 2000);
      } else {
        // For other errors, just show the error message
        setPunchStatus({ loading: false, message: `Error: ${errorMessage}`, error: true });
      }
    }
  };

  // --- Break Handlers ---
  const handleBreakStart = async () => {
    setPunchStatus({ loading: true, message: 'Starting break...', error: false });
    try {
      const response = await fetch('/api/break', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      const data = await response.json();

      if (!response.ok) {
        console.error("Break start API error:", data);
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      // Immediately update local break status
      setLocalBreakStatus(true);
      console.log('Break started, setting localBreakStatus to true');

      setPunchStatus({ loading: false, message: `${data.message || 'Break started!'} Page will refresh in a moment...`, error: false });

      // Show success message for 1.5 seconds before refreshing
      setTimeout(async () => {
        try {
          // Refresh data using the context
          await refreshData();
          // No need for a full page reload anymore
          setPunchStatus({
            loading: false,
            message: 'Break started! Data refreshed.',
            error: false
          });
        } catch (error) {
          console.error('Error refreshing data after break start:', error);
          // Fall back to page reload if refresh fails
          window.location.reload();
        }
      }, 1500);
    } catch (error: any) {
      console.error("Break start error:", error);

      // Provide more helpful error message based on common issues
      let errorMessage = error.message || 'Could not start break.';

      // If the error message contains "punch in", suggest the user to punch in first
      if (errorMessage.toLowerCase().includes('punch in')) {
        errorMessage = `${errorMessage} Please use the QR scanner to punch in first.`;
      }

      setPunchStatus({ loading: false, message: `Error: ${errorMessage}`, error: true });
    }
  };

  const handleBreakEnd = async () => {
    setPunchStatus({ loading: true, message: 'Ending break...', error: false });
    try {
      const response = await fetch('/api/break', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'end' }),
      });
      const data = await response.json();

      if (!response.ok) {
        console.error("Break end API error:", data);
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }

      // Immediately update local break status to show buttons
      setLocalBreakStatus(false);
      console.log('Break ended, setting localBreakStatus to false');

      setPunchStatus({ loading: false, message: `${data.message || 'Break ended!'} Page will refresh in a moment...`, error: false });

      // Show success message for 1.5 seconds before refreshing
      setTimeout(async () => {
        try {
          // Refresh data using the context
          await refreshData();
          // No need for a full page reload anymore
          setPunchStatus({
            loading: false,
            message: 'Break ended! Data refreshed.',
            error: false
          });
        } catch (error) {
          console.error('Error refreshing data after break end:', error);
          // Fall back to page reload if refresh fails
          window.location.reload();
        }
      }, 1500);
    } catch (error: any) {
      console.error("Break end error:", error);
      setPunchStatus({ loading: false, message: `Error: ${error.message || 'Could not end break.'}`, error: true });
    }
  };
  // ------------------------

  return (
    // Adjust grid gap for smaller screens
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
      {/* Timesheet Card */}
      <motion.div
        initial={{opacity:0, y:20}}
        animate={{opacity:1, y:0}}
        transition={{delay:0.05, type: "spring", stiffness: 100}}
        whileHover={{ scale: 1.02, boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}
        className="md:col-span-1 xl:col-span-1 bg-card/80 dark:bg-card/80 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-4 sm:p-6 flex flex-col items-center text-foreground transition-all duration-300"
      >
        <div className="w-full flex justify-between items-center mb-3">
          <div className="font-semibold text-lg text-foreground">Timesheet</div>
          <div className="flex flex-col items-end gap-1">
            <div className="text-muted-foreground text-xs px-2 py-1 bg-primary/10 rounded-full">
              {formatFullDate(currentTime)}
              <span className="ml-2 text-xs text-primary">({timezone.replace(/_/g, ' ')})</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={refreshData}
                className="inline-flex items-center px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors text-xs"
                disabled={isLoading}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                {isRealTimeEnabled ? 'Real-time: On' : 'Real-time: Off'}
              </button>
              <button
                onClick={toggleRealTimeUpdates}
                className="inline-flex items-center px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors text-xs"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                {isRealTimeEnabled ? 'Auto' : 'Manual'}
              </button>
            </div>
            {lastUpdateTime && (
              <div className="text-xs text-muted-foreground">
                Last updated: {formatInTimeZone(lastUpdateTime, timezone, 'h:mm:ss a')}
              </div>
            )}
          </div>
        </div>

        {/* Department Information */}
        {departmentName && (
          <div className="w-full mb-4 p-2 bg-primary/10 rounded-lg flex items-center justify-center">
            <span className="text-sm text-primary font-medium">Department: {departmentName}</span>
          </div>
        )}

        {/* PieChart with enhanced styling */}
        <div className="flex flex-col items-center mb-4">
          <div className="mb-2">
            <DynamicPieChartComponent todaySecs={finalTodaySecs} />
          </div>
          <div className="flex items-center justify-center bg-primary/10 px-4 py-2 rounded-full shadow-sm">
            <ClientOnlyTimeDisplay seconds={finalTodaySecs} />
            <span className="text-xs text-muted-foreground ml-2 mt-1">today</span>
          </div>
        </div>

        {/* Break/Overtime Stats */}
        <div className="grid grid-cols-2 gap-4 w-full mt-4 mb-4">
          <div className="flex flex-col items-center p-2 bg-primary/5 rounded-lg">
            <span className="text-xs text-muted-foreground mb-1">Break</span>
            <ClientOnlyBreakDisplay seconds={finalBreakSecs} />
          </div>
          <div className="flex flex-col items-center p-2 bg-primary/5 rounded-lg">
            <span className="text-xs text-muted-foreground mb-1">Overtime</span>
            <ClientOnlyOvertimeDisplay seconds={overtimeSecs} />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 w-full mt-2">
          {/* Break Buttons */}
          {(userStatus === 'signed_in') && !localBreakStatus && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  disabled={punchStatus.loading}
                  className="w-full px-6 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {punchStatus.loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    'Start Break'
                  )}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card border border-border">
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Break Start</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to start your break now?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-secondary text-secondary-foreground hover:bg-secondary/90">No, Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleBreakStart}
                    disabled={punchStatus.loading}
                    className="bg-amber-500 text-white hover:bg-amber-600"
                  >
                    Yes, Start Break
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* End Break Button */}
          {(userStatus === 'on_break') && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  disabled={punchStatus.loading}
                  className="w-full px-6 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold shadow-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {punchStatus.loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    'End Break'
                  )}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card border border-border">
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm End Break</AlertDialogTitle>
                  <AlertDialogDescription>
                    Your break has been <ClientOnlyBreakDuration
                      startTime={lastBreakStartLog ? new Date(lastBreakStartLog.timestamp || 0) : null}
                      currentTime={now}
                    />.
                    Are you ready to return to work?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-secondary text-secondary-foreground hover:bg-secondary/90">No, Continue Break</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleBreakEnd}
                    disabled={punchStatus.loading}
                    className="bg-green-500 text-white hover:bg-green-600"
                  >
                    Yes, End Break
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Punch Out Button */}
          {(userStatus === 'signed_in') && !localBreakStatus && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  disabled={punchStatus.loading}
                  className="w-full px-6 py-2 rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold shadow-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {punchStatus.loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    'Punch Out'
                  )}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-card border border-border">
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Punch Out</AlertDialogTitle>
                  <AlertDialogDescription>
                    You have worked approximately <ClientOnlyWorkDuration seconds={finalTodaySecs} /> today.
                    Are you sure you want to punch out now?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-secondary text-secondary-foreground hover:bg-secondary/90">No, Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handlePunchOut}
                    disabled={punchStatus.loading}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, Punch Out
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {/* Display punch status message */}
        {punchStatus.message && (
          <div className={`mt-3 p-2 w-full text-sm text-center rounded ${punchStatus.error ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-500'}`}>
            {punchStatus.message}
          </div>
        )}
      </motion.div>

      {/* Statistics Card */}
      <motion.div
        initial={{opacity:0, y:20}}
        animate={{opacity:1, y:0}}
        transition={{delay:0.1, type: "spring", stiffness: 100}}
        whileHover={{ scale: 1.02 }}
        className="md:col-span-1 xl:col-span-1 bg-card/80 dark:bg-card/80 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-4 sm:p-6 flex flex-col gap-3 text-foreground transition-all duration-300 hover:shadow-xl"
      >
        <div className="w-full flex justify-between items-center mb-3">
          <div className="font-semibold text-lg text-foreground">Statistics</div>
          <div className="text-xs text-muted-foreground px-2 py-1 bg-primary/10 rounded-full">
            {format(currentTime, 'MMM yyyy')}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {/* Enhanced stat bars with more visual information */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Today</span>
              <span className="text-xs font-semibold bg-primary/10 px-2 py-0.5 rounded-full">
                {finalTodayHrsDecimal.toFixed(1)} / 8 hrs
              </span>
            </div>
            <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
              <ClientOnlyProgressBar
                percentage={Math.min(finalTodayHrsDecimal / 8 * 100, 100)}
                colorClass={getStatBarColor('Today')}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">This Week</span>
              <span className="text-xs font-semibold bg-primary/10 px-2 py-0.5 rounded-full">
                {weekHrsDecimal.toFixed(1)} / 40 hrs
              </span>
            </div>
            <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
              <ClientOnlyProgressBar
                percentage={Math.min(weekHrsDecimal / 40 * 100, 100)}
                colorClass={getStatBarColor('This Week')}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">This Month</span>
              <span className="text-xs font-semibold bg-primary/10 px-2 py-0.5 rounded-full">
                {monthHrsDecimal.toFixed(1)} / 160 hrs
              </span>
            </div>
            <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
              <ClientOnlyProgressBar
                percentage={Math.min(monthHrsDecimal / 160 * 100, 100)}
                colorClass={getStatBarColor('This Month')}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Remaining Today</span>
              <span className="text-xs font-semibold bg-primary/10 px-2 py-0.5 rounded-full">
                {Math.max(0, 8 - finalTodayHrsDecimal).toFixed(1)} hrs
              </span>
            </div>
            <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
              <ClientOnlyProgressBar
                percentage={Math.min((Math.max(0, 8 - finalTodayHrsDecimal)) / 8 * 100, 100)}
                colorClass={getStatBarColor('Remaining')}
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Overtime Today</span>
              <span className="text-xs font-semibold bg-primary/10 px-2 py-0.5 rounded-full">
                {Math.max(0, finalTodayHrsDecimal - 8).toFixed(1)} hrs
              </span>
            </div>
            <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
              <ClientOnlyProgressBar
                percentage={Math.min((Math.max(0, finalTodayHrsDecimal - 8)) / 8 * 100, 100)}
                colorClass={getStatBarColor('Overtime')}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Today Activity */}
      <motion.div
        initial={{opacity:0, y:20}}
        animate={{opacity:1, y:0}}
        transition={{delay:0.15, type: "spring", stiffness: 100}}
        whileHover={{ scale: 1.02 }}
        className="md:col-span-1 xl:col-span-1 bg-card/80 dark:bg-card/80 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-4 sm:p-6 text-foreground transition-all duration-300 hover:shadow-xl"
      >
        <div className="w-full flex justify-between items-center mb-4">
          <div className="font-semibold text-lg text-foreground">Today Activity</div>
          <div className="text-xs text-muted-foreground px-2 py-1 bg-primary/10 rounded-full">
            {formatDate(todayStart.getTime())}
          </div>
        </div>

        {/* Activity Timeline */}
        <div className="relative">
          {sortedLogs.filter(l => isSameDay(new Date(l.timestamp || 0), todayStart)).length > 0 ? (
            <ol className="border-l-2 border-primary/50 pl-6 space-y-4">
              {sortedLogs.filter(l => isSameDay(new Date(l.timestamp || 0), todayStart)).map((l) => (
                <li key={l.id} className="relative">
                  {/* Enhanced dot with animation */}
                  <div className="absolute -left-[11px] top-0 flex items-center justify-center">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center ${
                      l.event_type === 'signin' ? 'bg-green-500/20' :
                      l.event_type === 'signout' ? 'bg-destructive/20' :
                      l.event_type === 'break_start' ? 'bg-amber-500/20' : 'bg-blue-500/20'
                    }`}>
                      <span className={`w-3 h-3 rounded-full ${
                        l.event_type === 'signin' ? 'bg-green-500' :
                        l.event_type === 'signout' ? 'bg-destructive' :
                        l.event_type === 'break_start' ? 'bg-amber-500' : 'bg-blue-500'
                      }`} />
                    </span>
                  </div>

                  {/* Card-like activity entry */}
                  <div className="bg-primary/5 rounded-lg p-3 transition-all duration-300 hover:bg-primary/10">
                    <div className="font-semibold text-sm text-foreground">
                      {l.event_type === 'signin' ? 'Punch In' :
                       l.event_type === 'signout' ? 'Punch Out' :
                       l.event_type === 'break_start' ? 'Break Start' : 'Break End'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formatTime(l.timestamp)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="bg-muted/20 rounded-lg p-6 text-center">
              <div className="text-muted-foreground mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground">No activity recorded today</p>
              <p className="text-xs text-muted-foreground mt-1">Use the QR scanner to punch in</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Attendance List Table */}
      <motion.div
        initial={{opacity:0, y:20}}
        animate={{opacity:1, y:0}}
        transition={{delay:0.2, type: "spring", stiffness: 100}}
        whileHover={{ scale: 1.01 }}
        className="col-span-1 md:col-span-2 xl:col-span-2 bg-card/80 dark:bg-card/80 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-4 sm:p-6 text-foreground transition-all duration-300 hover:shadow-xl"
      >
        <div className="w-full flex justify-between items-center mb-4">
          <div className="font-semibold text-lg text-foreground">Attendance Records</div>
          <div className="text-xs text-muted-foreground px-2 py-1 bg-primary/10 rounded-full">
            Last {attendancePairs.length} entries
          </div>
        </div>

        <div className="rounded-lg border border-border/50">
          <ResponsiveTable className="min-w-full text-sm">
            <ResponsiveTableHeader>
              <tr className="bg-primary/5">
                <ResponsiveTableHead className="px-4 py-3 text-left font-semibold text-foreground">Date</ResponsiveTableHead>
                <ResponsiveTableHead className="px-4 py-3 text-left font-semibold text-foreground">Punch In</ResponsiveTableHead>
                <ResponsiveTableHead className="px-4 py-3 text-left font-semibold text-foreground">Punch Out</ResponsiveTableHead>
                <ResponsiveTableHead className="px-4 py-3 text-left font-semibold text-foreground">Production</ResponsiveTableHead>
                <ResponsiveTableHead className="px-4 py-3 text-left font-semibold text-foreground">Break</ResponsiveTableHead>
                <ResponsiveTableHead className="px-4 py-3 text-left font-semibold text-foreground">Overtime</ResponsiveTableHead>
              </tr>
            </ResponsiveTableHeader>
            <ResponsiveTableBody>
              {attendancePairs.length > 0 ? (
                attendancePairs.map((pair, idx) => (
                  <ResponsiveTableRow
                    key={pair.in.id || idx}
                    className={clsx(
                      "border-b border-border/50 hover:bg-primary/5 transition-colors",
                      idx % 2 === 0 ? "bg-transparent" : "bg-muted/20"
                    )}
                  >
                    {/* Date column with better formatting */}
                    <ResponsiveTableCell header="Date" className="px-4 py-3">
                      <div className="font-medium text-foreground">{formatDate(pair.in.timestamp)}</div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(pair.in.timestamp || 0), 'EEE')}
                      </div>
                    </ResponsiveTableCell>

                    {/* Punch In time */}
                    <ResponsiveTableCell header="Punch In" className="px-4 py-3">
                      <div className="flex items-center">
                        <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                        <span className="text-foreground">{formatTime(pair.in.timestamp)}</span>
                      </div>
                    </ResponsiveTableCell>

                    {/* Punch Out time */}
                    <ResponsiveTableCell header="Punch Out" className="px-4 py-3">
                      {pair.out ? (
                        <div className="flex items-center">
                          <span className="w-2 h-2 rounded-full bg-destructive mr-2"></span>
                          <span className="text-foreground">{formatTime(pair.out.timestamp)}</span>
                        </div>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs bg-orange-500/20 text-orange-500 font-medium">Missing</span>
                      )}
                    </ResponsiveTableCell>

                    {/* Production time */}
                    <ResponsiveTableCell header="Production" className="px-4 py-3 font-medium">
                      {pair.out ? (
                        <ClientOnlyProductionTime startLog={pair.in} endLog={pair.out} />
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </ResponsiveTableCell>

                    {/* Break time */}
                    <ResponsiveTableCell header="Break" className="px-4 py-3">
                      {pair.breakTime ? (
                        <ClientOnlyBreakTime seconds={pair.breakTime} />
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </ResponsiveTableCell>

                    {/* Overtime */}
                    <ResponsiveTableCell header="Overtime" className="px-4 py-3">
                      {pair.overtime && pair.overtime > 0 ? (
                        <ClientOnlyOvertimeTime seconds={pair.overtime} />
                      ) : (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </ResponsiveTableCell>
                  </ResponsiveTableRow>
                ))
              ) : (
                <ResponsiveTableRow>
                  <ResponsiveTableCell colSpan={6} className="text-center py-8">
                    <div className="flex flex-col items-center justify-center text-muted-foreground">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm">No attendance records found</p>
                      <p className="text-xs mt-1">Use the QR scanner to record your attendance</p>
                    </div>
                  </ResponsiveTableCell>
                </ResponsiveTableRow>
              )}
            </ResponsiveTableBody>
          </ResponsiveTable>
        </div>
      </motion.div>

      {/* Daily Records Chart */}
      <motion.div
         initial={{opacity:0, y:20}}
         animate={{opacity:1, y:0}}
         transition={{delay:0.25, type: "spring", stiffness: 100}}
         whileHover={{ scale: 1.02 }}
         className="md:col-span-1 xl:col-span-1 bg-card/80 dark:bg-card/80 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-4 sm:p-6 text-foreground transition-all duration-300 hover:shadow-xl"
      >
        <div className="font-semibold text-lg mb-4 text-foreground">Daily Records</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={dailyData}>
            <XAxis dataKey="date" tickFormatter={(dateStr) => {
                try { return formatInTimeZone(new Date(dateStr + 'T00:00:00'), timezone, 'MMM d'); }
                catch { return 'Err'; }
            }} tick={{fontSize:10, fill: 'var(--color-muted-foreground)'}} />
            <YAxis tick={{fontSize:10, fill: 'var(--color-muted-foreground)'}} unit="h" />
            <Tooltip
              // Use simpler tooltip formatter
              formatter={(value: number) => {
                  // The raw value here is decimal hours from dailyData
                  // Convert back to seconds to use formatDurationTooltip
                  const seconds = value * 3600;
                  return [formatDurationTooltip(seconds), 'Duration'];
              }}
              cursor={{fill: 'var(--color-accent)', fillOpacity: 0.3}}
              contentStyle={{ backgroundColor: 'var(--color-popover)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)' }}
              labelStyle={{ color: 'var(--color-popover-foreground)' }}
              itemStyle={{ color: 'var(--color-popover-foreground)' }}
            />
            {/* Use primary color for bar */}
            <Bar dataKey="hours" fill="var(--color-primary)" radius={[4,4,0,0]} />
        </BarChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
}

function StatBar({ label, value, max, color }: { label: string, value: number, max: number, color: string }) {
  // Calculate percentage with fixed precision to avoid hydration mismatches
  const percentage = max > 0 ? (Math.min(100, (value / max) * 100)).toFixed(2) : "0";
  // Format the value (decimal hours) passed to StatBar for display
  const displayValue = value.toFixed(1); // Keep showing decimal hours here for simplicity

  return (
    <div>
      <div className="flex justify-between mb-1 text-sm">
        {/* Update text colors */}
        <span className="font-medium text-foreground">{label}</span>
         {/* Display as X.XX / Y hrs */}
        <span className="text-muted-foreground">{displayValue} / {max} hrs</span>
      </div>
      {/* Use muted for background bar */}
      <div className="w-full h-2 bg-muted/50 dark:bg-muted/50 rounded-full overflow-hidden">
        <div
           className={`h-2 rounded-full ${color} transition-all duration-500 ease-out`}
           style={{ width: `${percentage}%` }}
         />
      </div>
    </div>
  );
}
