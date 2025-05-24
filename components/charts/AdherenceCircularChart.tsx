'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

type AdherenceCircularChartProps = {
  data: {
    early: number;
    on_time: number;
    late: number;
    absent: number;
    not_set: number;
  };
  isLoading: boolean;
  title: string;
};

export default function AdherenceCircularChart({ data, isLoading, title }: AdherenceCircularChartProps) {
  const chartData = [
    { name: 'Early', value: data.early, color: '#2ecc71' },
    { name: 'On Time', value: data.on_time, color: '#3498db' },
    { name: 'Late', value: data.late, color: '#e74c3c' },
    { name: 'Absent', value: data.absent, color: '#e67e22' },
    { name: 'Not Set', value: data.not_set, color: '#95a5a6' },
  ].filter(item => item.value > 0);

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[250px] space-y-4">
            <Skeleton className="h-[200px] w-[200px] rounded-full" />
            <Skeleton className="h-4 w-[150px]" />
          </div>
        ) : (
          <div className="h-[250px] flex flex-col items-center">
            {total > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, value, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} days (${((value / total) * 100).toFixed(1)}%)`, 'Days']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div className="text-center mt-2">
                  <p className="text-sm text-muted-foreground">
                    Total: {total} days
                  </p>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">No data available</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
