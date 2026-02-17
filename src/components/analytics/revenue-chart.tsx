'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useState } from 'react';
import { exportRevenueToCSV } from '@/lib/analytics/export-csv';

interface RevenueChartProps {
  period: string;
  startDate?: Date;
  endDate?: Date;
}

export function RevenueChart({ period, startDate, endDate }: RevenueChartProps) {
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day');

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'revenue', period, granularity, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ period, granularity });
      if (period === 'custom' && startDate && endDate) {
        params.append('startDate', format(startDate, 'yyyy-MM-dd'));
        params.append('endDate', format(endDate, 'yyyy-MM-dd'));
      }
      const res = await fetch(`/api/analytics/revenue?${params}`);
      if (!res.ok) throw new Error('Failed to fetch revenue');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="h-[400px] flex items-center justify-center">
        <p className="text-muted-foreground">Loading chart...</p>
      </div>
    );
  }

  const chartData = data?.data?.map((item: any) => ({
    period: item.period,
    revenue: Number(item.total_revenue || 0),
    bookings: Number(item.total_bookings || 0),
    avgTicket: Number(item.avg_ticket || 0),
  })) || [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => data && exportRevenueToCSV(data)}
          disabled={!data}
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
        <Select value={granularity} onValueChange={(v) => setGranularity(v as any)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Daily</SelectItem>
            <SelectItem value="week">Weekly</SelectItem>
            <SelectItem value="month">Monthly</SelectItem>
          </SelectContent>
        </Select>

        <Select value={chartType} onValueChange={(v) => setChartType(v as any)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="line">Line Chart</SelectItem>
            <SelectItem value="bar">Bar Chart</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        {chartType === 'line' ? (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => {
                // Format based on granularity
                if (granularity === 'day') return value.split('-').slice(1).join('/');
                return value;
              }}
            />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value: any, name: string) => {
                if (name === 'revenue' || name === 'avgTicket') {
                  return [`R$ ${Number(value).toFixed(2)}`, name === 'revenue' ? 'Revenue' : 'Avg Ticket'];
                }
                return [value, 'Bookings'];
              }}
            />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="revenue"
              stroke="#8884d8"
              strokeWidth={2}
              name="Revenue"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="bookings"
              stroke="#82ca9d"
              strokeWidth={2}
              name="Bookings"
            />
          </LineChart>
        ) : (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => {
                if (granularity === 'day') return value.split('-').slice(1).join('/');
                return value;
              }}
            />
            <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value: any, name: string) => {
                if (name === 'revenue' || name === 'avgTicket') {
                  return [`R$ ${Number(value).toFixed(2)}`, name === 'revenue' ? 'Revenue' : 'Avg Ticket'];
                }
                return [value, 'Bookings'];
              }}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="revenue" fill="#8884d8" name="Revenue" />
            <Bar yAxisId="right" dataKey="bookings" fill="#82ca9d" name="Bookings" />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
