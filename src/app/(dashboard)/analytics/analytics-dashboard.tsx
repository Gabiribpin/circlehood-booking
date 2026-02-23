'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon, Download, TrendingUp, Users, DollarSign, Calendar as CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { exportOverviewToCSV } from '@/lib/analytics/export-csv';

// ─── Lazy loading — recharts é ~350KB gzipped; só carrega quando a aba é vista ──
const ChartFallback = ({ height = 400 }: { height?: number }) => (
  <div className={`h-[${height}px] flex items-center justify-center`}>
    <p className="text-muted-foreground text-sm">Carregando...</p>
  </div>
);

const RevenueChart = dynamic(
  () => import('@/components/analytics/revenue-chart').then((m) => ({ default: m.RevenueChart })),
  { loading: () => <ChartFallback height={400} />, ssr: false }
);

const ServicesRanking = dynamic(
  () => import('@/components/analytics/services-ranking').then((m) => ({ default: m.ServicesRanking })),
  { loading: () => <ChartFallback height={300} />, ssr: false }
);

const ClientsOverview = dynamic(
  () => import('@/components/analytics/clients-overview').then((m) => ({ default: m.ClientsOverview })),
  { loading: () => <ChartFallback height={400} />, ssr: false }
);

interface AnalyticsDashboardProps {
  professionalId: string;
  currency: string;
}

type PeriodType = 'day' | 'week' | 'month' | 'year' | 'custom';

const currencySymbols: Record<string, string> = { EUR: '€', GBP: '£', USD: '$', BRL: 'R$' };

export function AnalyticsDashboard({ professionalId, currency }: AnalyticsDashboardProps) {
  const [period, setPeriod] = useState<PeriodType>('month');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();

  const currencySymbol = currencySymbols[currency] ?? currency;

  // Fetch overview metrics
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['analytics', 'overview', period, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ period });
      if (period === 'custom' && startDate && endDate) {
        params.append('startDate', format(startDate, 'yyyy-MM-dd'));
        params.append('endDate', format(endDate, 'yyyy-MM-dd'));
      }
      const res = await fetch(`/api/analytics/overview?${params}`);
      if (!res.ok) throw new Error('Failed to fetch overview');
      return res.json();
    },
  });

  const handleExportCSV = () => {
    if (overview) {
      exportOverviewToCSV(overview);
    }
  };

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-2 items-center">
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selecionar período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Hoje</SelectItem>
              <SelectItem value="week">Últimos 7 dias</SelectItem>
              <SelectItem value="month">Últimos 30 dias</SelectItem>
              <SelectItem value="year">Último ano</SelectItem>
              <SelectItem value="custom">Período customizado</SelectItem>
            </SelectContent>
          </Select>

          {period === 'custom' && (
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-[140px] justify-start text-left font-normal',
                      !startDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, 'PPP') : 'Data inicial'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                </PopoverContent>
              </Popover>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-[140px] justify-start text-left font-normal',
                      !endDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, 'PPP') : 'Data final'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={endDate} onSelect={setEndDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>

        <Button onClick={handleExportCSV} variant="outline" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overviewLoading ? '...' : `${currencySymbol} ${overview?.totalRevenue?.toFixed(2) || '0.00'}`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {overview?.period?.startDate} a {overview?.period?.endDate}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agendamentos</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overviewLoading ? '...' : overview?.totalBookings || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {overview?.confirmedBookings || 0} confirmados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overviewLoading ? '...' : `${currencySymbol} ${overview?.averageTicket?.toFixed(2) || '0.00'}`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Por agendamento confirmado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Únicos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overviewLoading ? '...' : overview?.uniqueClients || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {overview?.cancelledRate?.toFixed(1) || 0}% taxa de cancelamento
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Receita</TabsTrigger>
          <TabsTrigger value="services">Serviços</TabsTrigger>
          <TabsTrigger value="clients">Clientes</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Receita ao longo do tempo</CardTitle>
              <CardDescription>Receita diária e tendências</CardDescription>
            </CardHeader>
            <CardContent>
              <RevenueChart period={period} startDate={startDate} endDate={endDate} currency={currency} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance dos Serviços</CardTitle>
              <CardDescription>Serviços mais rentáveis</CardDescription>
            </CardHeader>
            <CardContent>
              <ServicesRanking period={period} startDate={startDate} endDate={endDate} currency={currency} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análise de Clientes</CardTitle>
              <CardDescription>Segmentação e engajamento</CardDescription>
            </CardHeader>
            <CardContent>
              <ClientsOverview currency={currency} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
