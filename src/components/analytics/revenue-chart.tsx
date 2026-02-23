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
  currency: string;
}

const currencySymbols: Record<string, string> = { EUR: '€', GBP: '£', USD: '$', BRL: 'R$' };

export function RevenueChart({ period, startDate, endDate, currency }: RevenueChartProps) {
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day');

  const sym = currencySymbols[currency] ?? currency;

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
        <p className="text-muted-foreground">Carregando gráfico...</p>
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
          Exportar CSV
        </Button>
        <Select value={granularity} onValueChange={(v) => setGranularity(v as any)}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Diário</SelectItem>
            <SelectItem value="week">Semanal</SelectItem>
            <SelectItem value="month">Mensal</SelectItem>
          </SelectContent>
        </Select>

        <Select value={chartType} onValueChange={(v) => setChartType(v as any)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="line">Gráfico de Linha</SelectItem>
            <SelectItem value="bar">Gráfico de Barras</SelectItem>
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
              formatter={(value: any, name?: string) => {
                if (name === 'revenue' || name === 'avgTicket') {
                  return [`${sym} ${Number(value).toFixed(2)}`, name === 'revenue' ? 'Receita' : 'Ticket Médio'];
                }
                return [value, 'Agendamentos'];
              }}
            />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="revenue"
              stroke="#8884d8"
              strokeWidth={2}
              name="Receita"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="bookings"
              stroke="#82ca9d"
              strokeWidth={2}
              name="Agendamentos"
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
              formatter={(value: any, name?: string) => {
                if (name === 'revenue' || name === 'avgTicket') {
                  return [`${sym} ${Number(value).toFixed(2)}`, name === 'revenue' ? 'Receita' : 'Ticket Médio'];
                }
                return [value, 'Agendamentos'];
              }}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="revenue" fill="#8884d8" name="Receita" />
            <Bar yAxisId="right" dataKey="bookings" fill="#82ca9d" name="Agendamentos" />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
