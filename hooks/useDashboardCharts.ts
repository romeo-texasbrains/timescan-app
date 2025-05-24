'use client';

import { useState, useEffect } from 'react';

type WorkingDaysData = {
  totalDays: number;
  workedDays: number;
};

type AdherenceStatsData = {
  early: number;
  on_time: number;
  late: number;
  absent: number;
  not_set: number;
};

export function useDashboardCharts() {
  const [period, setPeriod] = useState<string>('month');
  const [workingDays, setWorkingDays] = useState<WorkingDaysData>({ totalDays: 0, workedDays: 0 });
  const [adherenceStats, setAdherenceStats] = useState<AdherenceStatsData>({
    early: 0,
    on_time: 0,
    late: 0,
    absent: 0,
    not_set: 0
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch working days data
      const workingDaysResponse = await fetch(`/api/dashboard/working-days?period=${period}`);
      if (workingDaysResponse.ok) {
        const workingDaysData = await workingDaysResponse.json();
        if (!workingDaysData.error) {
          setWorkingDays(workingDaysData);
        } else {
          console.error('Working days API error:', workingDaysData.error);
        }
      } else {
        console.error('Failed to fetch working days data:', workingDaysResponse.statusText);
      }

      // Fetch adherence stats data
      const adherenceStatsResponse = await fetch(`/api/dashboard/adherence-stats?period=${period}`);
      if (adherenceStatsResponse.ok) {
        const adherenceStatsData = await adherenceStatsResponse.json();
        if (!adherenceStatsData.error) {
          setAdherenceStats({
            early: adherenceStatsData.early || 0,
            on_time: adherenceStatsData.on_time || 0,
            late: adherenceStatsData.late || 0,
            absent: adherenceStatsData.absent || 0,
            not_set: adherenceStatsData.not_set || 0
          });
        } else {
          console.error('Adherence stats API error:', adherenceStatsData.error);
        }
      } else {
        console.error('Failed to fetch adherence stats data:', adherenceStatsResponse.statusText);
      }
    } catch (error) {
      console.error('Error fetching dashboard chart data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data when period changes
  useEffect(() => {
    fetchData();
  }, [period]);

  return {
    workingDays,
    adherenceStats,
    isLoading,
    period,
    setPeriod,
    refreshData: fetchData
  };
}
