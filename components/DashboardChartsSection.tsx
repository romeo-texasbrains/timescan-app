'use client';

import { motion } from "framer-motion";
import { useDashboardCharts } from '@/hooks/useDashboardCharts';
import WorkingDaysChart from '@/components/charts/WorkingDaysChart';
import AdherenceCircularChart from '@/components/charts/AdherenceCircularChart';
import TimePeriodFilter from '@/components/charts/TimePeriodFilter';

export default function DashboardChartsSection() {
  // Use the dashboard charts hook
  const {
    workingDays,
    adherenceStats,
    isLoading,
    period,
    setPeriod,
    refreshData
  } = useDashboardCharts();

  return (
    <div className="mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Dashboard Charts</h2>
        <TimePeriodFilter
          value={period}
          onChange={(newPeriod) => {
            setPeriod(newPeriod);
            refreshData();
          }}
        />
      </div>
      
      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        {/* Working Days Chart */}
        <motion.div
          initial={{opacity:0, y:20}}
          animate={{opacity:1, y:0}}
          transition={{delay:0.3, type: "spring", stiffness: 100}}
          whileHover={{ scale: 1.02 }}
        >
          <WorkingDaysChart 
            data={workingDays} 
            isLoading={isLoading}
            title="Working Days"
            period={period.charAt(0).toUpperCase() + period.slice(1)}
          />
        </motion.div>
        
        {/* Adherence Status Chart */}
        <motion.div
          initial={{opacity:0, y:20}}
          animate={{opacity:1, y:0}}
          transition={{delay:0.35, type: "spring", stiffness: 100}}
          whileHover={{ scale: 1.02 }}
        >
          <AdherenceCircularChart 
            data={adherenceStats} 
            isLoading={isLoading}
            title={`Adherence Status (${period.charAt(0).toUpperCase() + period.slice(1)})`}
          />
        </motion.div>
      </div>
    </div>
  );
}
