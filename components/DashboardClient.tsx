"use client";
import { format, isSameDay, startOfDay } from "date-fns";
import { formatInTimeZone } from 'date-fns-tz'; // Import timezone formatter
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import clsx from 'clsx';
import { Database } from "@/lib/supabase/database.types"; // Import database types
import { useState, useContext, useEffect } from "react"; // Import useState, useContext and useEffect
import { useRouter } from 'next/navigation'; // Import for page refresh
import dynamic from 'next/dynamic'; // Import dynamic
import { useTimezone } from '@/context/TimezoneContext'; // Correctly import the hook
import { useMediaQuery } from '@/hooks/useMediaQuery'; // Import useMediaQuery hook
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

// Helper function to calculate duration between two logs in seconds
function calculateDuration(startLog: AttendanceLog, endLog: AttendanceLog): number {
  if (!startLog?.timestamp || !endLog?.timestamp) return 0;
  const startTime = new Date(startLog.timestamp).getTime();
  const endTime = new Date(endLog.timestamp).getTime();
  // Ensure end time is after start time
  return endTime > startTime ? (endTime - startTime) / 1000 : 0;
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
  logs,
  userProfile,
  departmentName,
  timezone: serverTimezone
}: {
  logs: AttendanceLog[];
  userProfile: { full_name: string; role: string; department_id: string | null } | null;
  departmentName: string | null;
  timezone: string;
}) { // Use AttendanceLog type
  const router = useRouter(); // Get router instance
  const { timezone: contextTimezone } = useTimezone(); // Use the hook to get timezone

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

  // Calculate stats for Today, Week, Month
  const now = currentTime; // Use state variable for current time
  const todayStart = startOfDay(now);
  const weekStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay())); // Correct week start calculation
  const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));

  let todaySecs = 0;
  let weekSecs = 0;
  let monthSecs = 0;
  let breakTimeSecs = 0; // Track break time
  let overtimeSecs = 0; // Track overtime
  const dailyMap: Record<string, number> = {};
  const attendancePairs: { in: AttendanceLog, out: AttendanceLog | null, breakTime?: number, overtime?: number }[] = [];
  let lastSignInLog: AttendanceLog | null = null;
  let lastBreakStartLog: AttendanceLog | null = null;
  let isOnBreak = false;

  // Process logs to find pairs and calculate durations
  const sortedLogs = (logs || []).sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
  const processedIndices = new Set<number>();

  // Use timezone when calculating date strings for grouping if needed
  const dateStrToTimezone = (date: Date) => {
      try {
        return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
      } catch { return 'invalid-date'; } // Handle potential errors
  };

  // First pass: collect all break periods
  const breakPeriods: { start: AttendanceLog, end: AttendanceLog | null }[] = [];

  for (let i = 0; i < sortedLogs.length; i++) {
    const currentLog = sortedLogs[i];

    if (currentLog.event_type === 'break_start') {
      let foundBreakEnd = false;

      // Look for matching break_end
      for (let j = i + 1; j < sortedLogs.length; j++) {
        const nextLog = sortedLogs[j];
        if (
          nextLog.event_type === 'break_end' &&
          isSameDay(new Date(currentLog.timestamp || 0), new Date(nextLog.timestamp || 0))
        ) {
          breakPeriods.push({ start: currentLog, end: nextLog });
          processedIndices.add(i);
          processedIndices.add(j);
          foundBreakEnd = true;
          break;
        }
      }

      // Handle unpaired break_start
      if (!foundBreakEnd) {
        breakPeriods.push({ start: currentLog, end: null });
        processedIndices.add(i);

        // If the last event is an unpaired break_start, user is currently on break
        if (i === sortedLogs.length - 1) {
          isOnBreak = true;
          lastBreakStartLog = currentLog;
        }
      }
    }
  }

  // Calculate total break time
  breakPeriods.forEach(period => {
    if (period.end) {
      const breakDuration = calculateDuration(period.start, period.end);
      breakTimeSecs += breakDuration;
    } else {
      // For ongoing break, calculate duration until now
      if (isOnBreak && lastBreakStartLog) {
        const ongoingBreakDuration = (now.getTime() - new Date(lastBreakStartLog.timestamp || 0).getTime()) / 1000;
        breakTimeSecs += ongoingBreakDuration;
      }
    }
  });

  // Second pass: process signin/signout pairs
  for (let i = 0; i < sortedLogs.length; i++) {
    if (processedIndices.has(i)) continue; // Skip if already processed

    const currentLog = sortedLogs[i];
    if (currentLog.event_type === 'signin') {
      lastSignInLog = currentLog; // Update last sign in
      let foundPair = false;

      // Look for the next signout (allowing overnight shifts)
      for (let j = i + 1; j < sortedLogs.length; j++) {
        if (processedIndices.has(j)) continue; // Skip if already paired

        const nextLog = sortedLogs[j];
        if (nextLog.event_type === 'signout') {
          const duration = calculateDuration(currentLog, nextLog);
          const logDate = startOfDay(new Date(currentLog.timestamp || 0));
          const dateStr = dateStrToTimezone(logDate); // Use consistent date format

          // Calculate overtime (if duration > 8 hours)
          const standardWorkdaySecs = 8 * 3600; // 8 hours in seconds
          const pairOvertimeSecs = Math.max(0, duration - standardWorkdaySecs);

          // Add duration to totals
          if (isSameDay(logDate, todayStart)) {
            todaySecs += duration;
            overtimeSecs += pairOvertimeSecs;
          }
          if (logDate >= weekStart) weekSecs += duration;
          if (logDate >= monthStart) monthSecs += duration;
          dailyMap[dateStr] = (dailyMap[dateStr] || 0) + duration;

          // Find break periods within this signin/signout pair
          const pairBreakSecs = breakPeriods
            .filter(bp =>
              bp.start.timestamp && bp.end?.timestamp &&
              new Date(bp.start.timestamp).getTime() >= new Date(currentLog.timestamp || 0).getTime() &&
              new Date(bp.end.timestamp).getTime() <= new Date(nextLog.timestamp || 0).getTime()
            )
            .reduce((total, bp) => total + calculateDuration(bp.start, bp.end!), 0);

          attendancePairs.push({
            in: currentLog,
            out: nextLog,
            overtime: pairOvertimeSecs,
            breakTime: pairBreakSecs > 0 ? pairBreakSecs : undefined
          });

          processedIndices.add(i);
          processedIndices.add(j);
          foundPair = true;
          lastSignInLog = null; // Paired, reset last sign in
          break; // Found the pair for this signin
        }
      }

      // Handle unpaired signin (add to pairs list with null signout)
      if (!foundPair) {
        attendancePairs.push({ in: currentLog, out: null });
        processedIndices.add(i); // Mark as processed even if unpaired
      }
    } else if (currentLog.event_type === 'signout') {
      // Handle potential signout without preceding signin
      processedIndices.add(i); // Mark as processed
      lastSignInLog = null; // Sign out occurred, reset last sign in
    }
  }

  const dailyData = Object.entries(dailyMap)
    .map(([date, secs]) => ({ date, hours: +(secs / 3600).toFixed(2) }))
    .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort daily data for chart

  // Determine if user is currently signed in by analyzing the sequence of events
  let isCurrentlySignedIn = false;

  // Process all logs chronologically to determine current state
  for (const log of sortedLogs) {
    if (log.event_type === 'signin') {
      isCurrentlySignedIn = true;
    } else if (log.event_type === 'signout') {
      isCurrentlySignedIn = false;
    }
    // Break events don't affect signed-in status
  }

  // Also consider the lastSignInLog as a backup check
  if (!!lastSignInLog && !isCurrentlySignedIn) {
    console.log('Warning: State calculation shows not signed in, but lastSignInLog exists. Using lastSignInLog as fallback.');
    isCurrentlySignedIn = true;
  }

  // Add a useEffect to log the current sign-in state for debugging
  useEffect(() => {
    console.log('Current sign-in state:', isCurrentlySignedIn ? 'Signed In' : 'Signed Out');
    console.log('Last log event type:', sortedLogs.length > 0 ? sortedLogs[sortedLogs.length - 1].event_type : 'None');
  }, [isCurrentlySignedIn, sortedLogs]);

  // Calculate current dynamic session duration if signed in
  let currentSessionDurationSecs = 0;
  if (isCurrentlySignedIn && lastSignInLog?.timestamp) {
    currentSessionDurationSecs = (currentTime.getTime() - new Date(lastSignInLog.timestamp).getTime()) / 1000;
  }
  const finalTodaySecs = todaySecs + currentSessionDurationSecs; // Total today's time including ongoing
  const finalWeekSecs = weekSecs + (isSameDay(now, todayStart) ? currentSessionDurationSecs : 0); // Add ongoing to week if today
  const finalMonthSecs = monthSecs + (isSameDay(now, todayStart) ? currentSessionDurationSecs : 0); // Add ongoing to month if today

  // Calculate decimal hours for components expecting numbers
  const finalTodayHrsDecimal = finalTodaySecs / 3600;
  const weekHrsDecimal = finalWeekSecs / 3600;
  const monthHrsDecimal = finalMonthSecs / 3600;

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
      setTimeout(() => {
        console.log('Refreshing page after punch out...');
        // Force a full page reload instead of just a router refresh
        window.location.href = '/?t=' + new Date().getTime(); // Add timestamp to prevent caching
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

        // Force a page reload after 2 seconds to sync the UI with the server
        setTimeout(() => {
          window.location.reload();
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

      setPunchStatus({ loading: false, message: `${data.message || 'Break started!'} Page will refresh in a moment...`, error: false });

      // Show success message for 1.5 seconds before refreshing
      setTimeout(() => {
        // Force a full page reload instead of just a router refresh
        window.location.reload();
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

      setPunchStatus({ loading: false, message: `${data.message || 'Break ended!'} Page will refresh in a moment...`, error: false });

      // Show success message for 1.5 seconds before refreshing
      setTimeout(() => {
        // Force a full page reload instead of just a router refresh
        window.location.reload();
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
          <div className="text-muted-foreground text-xs px-2 py-1 bg-primary/10 rounded-full">{formatFullDate(currentTime)}</div>
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
            <ClientOnlyBreakDisplay seconds={breakTimeSecs} />
          </div>
          <div className="flex flex-col items-center p-2 bg-primary/5 rounded-lg">
            <span className="text-xs text-muted-foreground mb-1">Overtime</span>
            <ClientOnlyOvertimeDisplay seconds={overtimeSecs} />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 w-full mt-2">
          {/* Break Buttons */}
          {isCurrentlySignedIn && !isOnBreak && (
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
          {isOnBreak && (
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
          {isCurrentlySignedIn && !isOnBreak && (
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
              formatter={(value: number, name: string, props: any) => {
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
