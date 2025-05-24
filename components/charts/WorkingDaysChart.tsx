'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

type WorkingDaysChartProps = {
  data: {
    totalDays: number;
    workedDays: number;
  };
  isLoading: boolean;
  title: string;
  period: string;
};

export default function WorkingDaysChart({ data, isLoading, title, period }: WorkingDaysChartProps) {
  const chartData = [
    { name: 'Worked', value: data.workedDays, color: '#3498db' },
    { name: 'Remaining', value: Math.max(0, data.totalDays - data.workedDays), color: '#e0e0e0' },
  ];

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{title} ({period})</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-[250px] space-y-4">
            <Skeleton className="h-[200px] w-[200px] rounded-full" />
            <Skeleton className="h-4 w-[150px]" />
          </div>
        ) : (
          <div className="h-[250px] flex flex-col items-center">
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
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value} days`, 'Days']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
            <div className="text-center mt-2">
              <p className="text-sm text-muted-foreground">
                Worked {data.workedDays} out of {data.totalDays} days
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
