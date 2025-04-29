"use client";
import { format, isSameDay, startOfDay } from "date-fns";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Database } from "@/lib/supabase/database.types"; // Import database types
import { useState } from "react"; // Import useState
import { useRouter } from 'next/navigation'; // Import for page refresh
import dynamic from 'next/dynamic'; // Import dynamic

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
  const COLORS = ['#2563eb', '#e5e7eb']; // blue-600, gray-200

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

export default function DashboardClient({ logs }: { logs: AttendanceLog[] }) { // Use AttendanceLog type
  const router = useRouter(); // Get router instance
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
          const dateStr = format(logDate, 'yyyy-MM-dd'); // Use consistent date format

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

  // --- Punch Out Handler --- 
  const handlePunchOut = async () => {
    setPunchStatus({ loading: true, message: 'Processing punch...', error: false });
    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send placeholder data - API validation allows non-empty string
        body: JSON.stringify({ qrCodeData: 'manual_dashboard_punch' }), 
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Timesheet Card - NOTE: Pie chart logic might need adjustment based on how '8 hours' is defined */}
      <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.05}} className="col-span-1 bg-white dark:bg-gray-800 rounded-xl shadow p-6 flex flex-col items-center">
        <div className="font-semibold text-lg mb-2">Timesheet</div>
        <div className="text-gray-500 text-sm mb-2">{format(now, 'PPPP')}</div>
        <DynamicPieChartComponent todaySecs={todaySecs} />
        <div className="text-3xl font-bold my-2">{hours(todaySecs)} hrs</div>
        {/* Punch Out Button - Conditionally enabled */}
        <button 
          onClick={handlePunchOut}
          disabled={!isCurrentlySignedIn || punchStatus.loading} 
          className="mt-2 px-6 py-2 rounded bg-red-600 hover:bg-red-700 text-white font-semibold shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {punchStatus.loading ? 'Processing...' : 'Punch Out'}
        </button>
        {/* Display punch status message */}
        {punchStatus.message && (
          <p className={`mt-2 text-sm ${punchStatus.error ? 'text-red-600' : 'text-green-600'}`}>
            {punchStatus.message}
          </p>
        )}
        {/* TODO: Calculate Break/Overtime dynamically */}
        <div className="flex w-full justify-between mt-4 text-xs text-gray-500">
          <span>Break -- hrs</span>
          <span>Overtime -- hrs</span>
        </div>
      </motion.div>

      {/* Statistics Card - TODO: Calculate Overtime Dynamically */}
      <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.1}} className="col-span-1 bg-white dark:bg-gray-800 rounded-xl shadow p-6 flex flex-col gap-3">
        <div className="font-semibold text-lg mb-2">Statistics</div>
        <div className="flex flex-col gap-2">
          <StatBar label="Today" value={+hours(todaySecs)} max={8} color="bg-blue-500" />
          <StatBar label="This Week" value={+hours(weekSecs)} max={40} color="bg-green-500" />
          <StatBar label="This Month" value={+hours(monthSecs)} max={160} color="bg-yellow-500" />
          <StatBar label="Remaining" value={Math.max(0, 8-+hours(todaySecs))} max={8} color="bg-gray-400" />
          <StatBar label="Overtime" value={0} max={8} color="bg-red-500" /> {/* Placeholder */}
        </div>
      </motion.div>

      {/* Today Activity */}
      <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.15}} className="col-span-1 bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <div className="font-semibold text-lg mb-2">Today Activity</div>
        <ol className="border-l-2 border-blue-500 pl-6">
          {sortedLogs.filter(l => isSameDay(new Date(l.timestamp || 0), todayStart)).map((l) => (
            <li key={l.id} className="mb-3 relative">
              <span className={`absolute -left-[7px] top-1 w-3 h-3 rounded-full ${l.event_type === 'signin' ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="font-semibold text-sm ml-2">{l.event_type === 'signin' ? 'Punch In' : 'Punch Out'} at {format(new Date(l.timestamp || 0), 'h:mm a')}</span>
            </li>
          ))}
           {sortedLogs.filter(l => isSameDay(new Date(l.timestamp || 0), todayStart)).length === 0 && <li className="text-sm text-gray-500">No activity today.</li>}
        </ol>
      </motion.div>

      {/* Attendance List Table - Uses processed attendancePairs */}
      <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.2}} className="col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <div className="font-semibold text-lg mb-4">Attendance List</div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-700">
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Punch In</th>
                <th className="px-4 py-2 text-left">Punch Out</th>
                <th className="px-4 py-2 text-left">Production</th>
                <th className="px-4 py-2 text-left">Break</th>
                <th className="px-4 py-2 text-left">Overtime</th>
              </tr>
            </thead>
            <tbody>
              {attendancePairs.map((pair, idx) => (
                <tr key={pair.in.id || idx} className="hover:bg-blue-50 dark:hover:bg-blue-900 transition-colors">
                  <td className="px-4 py-2">{format(new Date(pair.in.timestamp || 0), 'PP')}</td>
                  <td className="px-4 py-2">{format(new Date(pair.in.timestamp || 0), 'h:mm a')}</td>
                  <td className="px-4 py-2">{pair.out ? format(new Date(pair.out.timestamp || 0), 'h:mm a') : <span className="text-orange-500">Missing</span>}</td>
                  <td className="px-4 py-2">{pair.out ? hours(calculateDuration(pair.in, pair.out)) + ' hrs' : '-'}</td>
                  {/* TODO: Calculate Break/Overtime */}
                  <td className="px-4 py-2">-- hrs</td>
                  <td className="px-4 py-2">-- hrs</td>
                </tr>
              ))}
               {attendancePairs.length === 0 && (
                 <tr><td colSpan={6} className="text-center py-4 text-gray-500">No attendance data.</td></tr>
                )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* Daily Records Chart - Uses processed dailyData */}
      <motion.div initial={{opacity:0, y:20}} animate={{opacity:1, y:0}} transition={{delay:0.25}} className="col-span-1 bg-white dark:bg-gray-800 rounded-xl shadow p-6">
        <div className="font-semibold text-lg mb-4">Daily Records</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={dailyData}>
            <XAxis dataKey="date" tickFormatter={(dateStr) => format(new Date(dateStr), 'MMM d')} tick={{fontSize:10}} />
            <YAxis tick={{fontSize:10}} unit="h" />
            <Tooltip formatter={(value: number) => [`${value.toFixed(2)} hrs`, 'Hours']} />
            <Bar dataKey="hours" fill="#2563eb" radius={[4,4,0,0]} />
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
        <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
        <span className="text-gray-600 dark:text-gray-400">{value.toFixed(2)} / {max} hrs</span>
      </div>
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
           className={`h-2 rounded-full ${color} transition-all duration-500 ease-out`}
           style={{ width: `${percentage}%` }}
         />
      </div>
    </div>
  );
}
