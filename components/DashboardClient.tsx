"use client";
import { format, isSameDay, startOfDay } from "date-fns";
import { formatInTimeZone } from 'date-fns-tz'; // Import timezone formatter
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Database } from "@/lib/supabase/database.types"; // Import database types
import { useState, useContext } from "react"; // Import useState and useContext
import { useRouter } from 'next/navigation'; // Import for page refresh
import dynamic from 'next/dynamic'; // Import dynamic
import { useTimezone } from '@/context/TimezoneContext'; // Correctly import the hook

type AttendanceLog = Database['public']['Tables']['attendance_logs']['Row'];

// Helper function to calculate duration between two logs in seconds
function calculateDuration(startLog: AttendanceLog, endLog: AttendanceLog): number {
  if (!startLog?.timestamp || !endLog?.timestamp) return 0;
  const startTime = new Date(startLog.timestamp).getTime();
  const endTime = new Date(endLog.timestamp).getTime();
  // Ensure end time is after start time
  return endTime > startTime ? (endTime - startTime) / 1000 : 0;
}

// --- Dynamic Wrapper for Pie Chart ---
const DynamicPieChartComponent = dynamic(() => Promise.resolve(InnerPieChart), {
  ssr: false,
  loading: () => <div style={{ width: 120, height: 120 }} className="flex items-center justify-center text-sm text-gray-500">Loading chart...</div>, // Optional loading state
});

function InnerPieChart({ todaySecs }: { todaySecs: number }) {
  const data = [
    { value: Math.max(0, todaySecs / 3600) },
    { value: Math.max(0, 8 - (todaySecs / 3600)) }
  ];
  // Use theme colors: primary and muted/accent
  const COLORS = ['var(--color-primary)', 'var(--color-muted)'];

  return (
    <div style={{ width: 120, height: 120 }}>
      <PieChart width={120} height={120}>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={40}
          outerRadius={55}
          dataKey="value"
          startAngle={90}
          endAngle={-270}
          paddingAngle={0} // No padding needed for 2 segments
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke={COLORS[index % COLORS.length]}/>
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

export default function DashboardClient({ logs }: { logs: AttendanceLog[] }) { // Use AttendanceLog type
  const router = useRouter(); // Get router instance
  const { timezone } = useTimezone(); // Use the hook to get timezone
  // State for punch out action
  const [punchStatus, setPunchStatus] = useState<{ loading: boolean; message: string; error: boolean }>({ loading: false, message: '', error: false });

  // Calculate stats for Today, Week, Month
  const now = new Date();
  const todayStart = startOfDay(now);
  const weekStart = startOfDay(new Date(now.setDate(now.getDate() - now.getDay())));
  const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));

  let todaySecs = 0;
  let weekSecs = 0;
  let monthSecs = 0;
  const dailyMap: Record<string, number> = {};
  const attendancePairs: { in: AttendanceLog, out: AttendanceLog | null }[] = [];
  let lastSignInLog: AttendanceLog | null = null;

  // Process logs to find pairs and calculate durations
  const sortedLogs = (logs || []).sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
  const processedIndices = new Set<number>();

  // Use timezone when calculating date strings for grouping if needed
  const dateStrToTimezone = (date: Date) => {
      try {
        return formatInTimeZone(date, timezone, 'yyyy-MM-dd');
      } catch { return 'invalid-date'; } // Handle potential errors
  };

  for (let i = 0; i < sortedLogs.length; i++) {
    if (processedIndices.has(i)) continue; // Skip if already part of a pair

    const currentLog = sortedLogs[i];
    if (currentLog.event_type === 'signin') {
      lastSignInLog = currentLog; // Update last sign in
      let foundPair = false;
      // Look for the next signout on the same day
      for (let j = i + 1; j < sortedLogs.length; j++) {
        if (processedIndices.has(j)) continue; // Skip if already paired

        const nextLog = sortedLogs[j];
        if (
          nextLog.event_type === 'signout' &&
          isSameDay(new Date(currentLog.timestamp || 0), new Date(nextLog.timestamp || 0))
        ) {
          const duration = calculateDuration(currentLog, nextLog);
          const logDate = startOfDay(new Date(currentLog.timestamp || 0));
          const dateStr = dateStrToTimezone(logDate); // Use consistent date format

          // Add duration to totals
          if (isSameDay(logDate, todayStart)) todaySecs += duration;
          if (logDate >= weekStart) weekSecs += duration;
          if (logDate >= monthStart) monthSecs += duration;
          dailyMap[dateStr] = (dailyMap[dateStr] || 0) + duration;

          attendancePairs.push({ in: currentLog, out: nextLog });
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
    } else {
        // Handle potential signout without preceding signin (or already processed)
        processedIndices.add(i); // Mark as processed
        lastSignInLog = null; // Sign out occurred, reset last sign in
    }
  }

  const hours = (secs: number) => (secs / 3600).toFixed(2);
  const dailyData = Object.entries(dailyMap)
    .map(([date, secs]) => ({ date, hours: +(secs / 3600).toFixed(2) }))
    .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort daily data for chart

  // Determine if user is currently signed in (last processed log was an unpaired signin)
  const isCurrentlySignedIn = !!lastSignInLog; 

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
    setPunchStatus({ loading: true, message: 'Processing punch...', error: false });
    try {
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
      setPunchStatus({ loading: false, message: data.message || 'Punch successful!', error: false });
      // Refresh data after successful punch
      router.refresh(); 
    } catch (error: any) {
      console.error("Punch out error:", error);
      setPunchStatus({ loading: false, message: `Error: ${error.message || 'Could not process punch.'}`, error: true });
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
        transition={{delay:0.05}}
        whileHover={{ scale: 1.02 }} // Add scale on hover
        // Add glass effect classes, use bg-card, update text colors
        // Responsive span (full width on small, half on medium, third on xl+)
        className="md:col-span-1 xl:col-span-1 bg-card/80 dark:bg-card/80 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-4 sm:p-6 flex flex-col items-center text-foreground transition-shadow hover:shadow-xl"
      >
        <div className="font-semibold text-lg mb-2 text-foreground">Timesheet</div>
        <div className="text-muted-foreground text-sm mb-2">{formatFullDate(now)}</div>
        {/* TODO: Update PieChart colors to match theme */}
        <DynamicPieChartComponent todaySecs={todaySecs} />
        <div className="text-3xl font-bold my-2 text-foreground">{hours(todaySecs)} hrs</div>
        {/* Punch Out Button - Use destructive variant */}
        <button 
          onClick={handlePunchOut}
          disabled={!isCurrentlySignedIn || punchStatus.loading} 
          // Use destructive button styles
          className="mt-2 px-6 py-2 rounded bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {punchStatus.loading ? 'Processing...' : 'Punch Out'}
        </button>
        {/* Display punch status message */}
        {punchStatus.message && (
          // Adjust colors based on theme
          <p className={`mt-2 text-sm ${punchStatus.error ? 'text-destructive' : 'text-green-500'}`}>
            {punchStatus.message}
          </p>
        )}
        {/* TODO: Calculate Break/Overtime dynamically */}
        <div className="flex w-full justify-between mt-4 text-xs text-muted-foreground">
          <span>Break -- hrs</span>
          <span>Overtime -- hrs</span>
        </div>
      </motion.div>

      {/* Statistics Card */}
      <motion.div
        initial={{opacity:0, y:20}}
        animate={{opacity:1, y:0}}
        transition={{delay:0.1}}
        whileHover={{ scale: 1.02 }} // Add scale on hover
        // Add glass effect classes, use bg-card, update text colors
        // Responsive span
        className="md:col-span-1 xl:col-span-1 bg-card/80 dark:bg-card/80 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-4 sm:p-6 flex flex-col gap-3 text-foreground transition-shadow hover:shadow-xl"
      >
        <div className="font-semibold text-lg mb-2 text-foreground">Statistics</div>
        <div className="flex flex-col gap-2">
          {/* Use helper function for colors */}
          <StatBar label="Today" value={+hours(todaySecs)} max={8} color={getStatBarColor('Today')} />
          <StatBar label="This Week" value={+hours(weekSecs)} max={40} color={getStatBarColor('This Week')} />
          <StatBar label="This Month" value={+hours(monthSecs)} max={160} color={getStatBarColor('This Month')} />
          <StatBar label="Remaining" value={Math.max(0, 8-+hours(todaySecs))} max={8} color={getStatBarColor('Remaining')} />
          <StatBar label="Overtime" value={0} max={8} color={getStatBarColor('Overtime')} /> {/* Placeholder */}
        </div>
      </motion.div>

      {/* Today Activity */}
      <motion.div
        initial={{opacity:0, y:20}}
        animate={{opacity:1, y:0}}
        transition={{delay:0.15}}
        whileHover={{ scale: 1.02 }} // Add scale on hover
        // Add glass effect classes, use bg-card, update text colors
        // Responsive span
        className="md:col-span-1 xl:col-span-1 bg-card/80 dark:bg-card/80 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-4 sm:p-6 text-foreground transition-shadow hover:shadow-xl"
      >
        <div className="font-semibold text-lg mb-2 text-foreground">Today Activity</div>
        {/* Use primary color for border */}
        <ol className="border-l-2 border-primary pl-6">
          {sortedLogs.filter(l => isSameDay(new Date(l.timestamp || 0), todayStart)).map((l) => (
            <li key={l.id} className="mb-3 relative">
              {/* Adjust signin/signout dot colors */}
              <span className={`absolute -left-[7px] top-1 w-3 h-3 rounded-full ${l.event_type === 'signin' ? 'bg-green-500' : 'bg-destructive'}`} />
              {/* Format activity time using the global timezone */}
              <span className="font-semibold text-sm ml-2 text-foreground">{l.event_type === 'signin' ? 'Punch In' : 'Punch Out'} at {formatTime(l.timestamp)}</span>
            </li>
          ))}
           {sortedLogs.filter(l => isSameDay(new Date(l.timestamp || 0), todayStart)).length === 0 && <li className="text-sm text-muted-foreground">No activity today.</li>}
        </ol>
      </motion.div>

      {/* Attendance List Table */}
      <motion.div
        initial={{opacity:0, y:20}}
        animate={{opacity:1, y:0}}
        transition={{delay:0.2}}
        whileHover={{ scale: 1.01 }} // Slightly less scale for larger card
        // Add glass effect classes, use bg-card, update text colors
        // Responsive span (full width on small/medium, 2/3 on xl+)
        className="col-span-1 md:col-span-2 xl:col-span-2 bg-card/80 dark:bg-card/80 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-4 sm:p-6 text-foreground transition-shadow hover:shadow-xl"
      >
        <div className="font-semibold text-lg mb-4 text-foreground">Attendance List</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              {/* Use card/muted for header bg, update text */}
              <tr className="bg-muted/50 dark:bg-muted/50">
                <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Date</th>
                <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Punch In</th>
                <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Punch Out</th>
                <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Production</th>
                <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Break</th>
                <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Overtime</th>
              </tr>
            </thead>
            <tbody>
              {attendancePairs.map((pair, idx) => (
                // Use accent for hover, update text
                <tr key={pair.in.id || idx} className="border-b border-border hover:bg-accent/50 dark:hover:bg-accent/50 transition-colors">
                  {/* Format table dates/times using the global timezone */}
                  <td className="px-4 py-2 text-foreground">{formatDate(pair.in.timestamp)}</td>
                  <td className="px-4 py-2 text-foreground">{formatTime(pair.in.timestamp)}</td>
                  <td className="px-4 py-2 text-foreground">{pair.out ? formatTime(pair.out.timestamp) : <span className="text-orange-500">Missing</span>}</td>
                  <td className="px-4 py-2 text-foreground">{pair.out ? hours(calculateDuration(pair.in, pair.out)) + ' hrs' : '-'}</td>
                  {/* TODO: Calculate Break/Overtime */}
                  <td className="px-4 py-2 text-muted-foreground">-- hrs</td>
                  <td className="px-4 py-2 text-muted-foreground">-- hrs</td>
                </tr>
              ))}
               {attendancePairs.length === 0 && (
                 <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">No attendance data.</td></tr>
                )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Daily Records Chart */}
      <motion.div
         initial={{opacity:0, y:20}}
         animate={{opacity:1, y:0}}
         transition={{delay:0.25}}
         whileHover={{ scale: 1.02 }} // Add scale on hover
         // Add glass effect classes, use bg-card, update text colors
         // Responsive span (full width on small, half on medium, third on xl+)
         className="md:col-span-1 xl:col-span-1 bg-card/80 dark:bg-card/80 backdrop-blur-md border border-white/10 rounded-xl shadow-lg p-4 sm:p-6 text-foreground transition-shadow hover:shadow-xl"
      >
        <div className="font-semibold text-lg mb-4 text-foreground">Daily Records</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={dailyData}>
            <XAxis dataKey="date" tickFormatter={(dateStr) => {
                try { return formatInTimeZone(new Date(dateStr), timezone, 'MMM d'); }
                catch { return 'Err'; }
            }} tick={{fontSize:10, fill: 'var(--color-muted-foreground)'}} />
            <YAxis tick={{fontSize:10, fill: 'var(--color-muted-foreground)'}} unit="h" />
            <Tooltip
              formatter={(value: number) => [`${value.toFixed(2)} hrs`, 'Hours']}
              labelFormatter={(label) => {
                  try { return formatInTimeZone(new Date(label), timezone, 'PP'); }
                  catch { return 'Invalid Date'; }
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
  const percentage = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between mb-1 text-sm">
        {/* Update text colors */}
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">{value.toFixed(2)} / {max} hrs</span>
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
