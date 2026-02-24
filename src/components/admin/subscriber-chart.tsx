'use client';

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export interface ChartDataPoint {
  label: string;
  registrations: number;
  converted: number;
  cumulative: number;
}

interface SubscriberChartProps {
  data: ChartDataPoint[];
}

export function SubscriberChart({ data }: SubscriberChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={{ stroke: '#334155' }}
          tickLine={false}
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '8px',
            color: '#f1f5f9',
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: '#94a3b8' }}
        />
        <Bar
          yAxisId="left"
          dataKey="registrations"
          name="Novos registros"
          fill="#6366f1"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          yAxisId="left"
          dataKey="converted"
          name="Convertidos (Pro)"
          fill="#22c55e"
          radius={[4, 4, 0, 0]}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="cumulative"
          name="Total acumulado"
          stroke="#f59e0b"
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
