'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
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
const ChartFallback = ({ height = 400 }: { height?: number }) => {
  const t = useTranslations('analytics');
  return (
    <div className={`h-[${height}px] flex items-center justify-center`}>
      <p className="text-muted-foreground text-sm">{t('loading')}</p>
    </div>
  );
};

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
  const t = useTranslations('analytics');
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
              <SelectValue placeholder={t('selectPeriod')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">{t('today')}</SelectItem>
              <SelectItem value="week">{t('last7days')}</SelectItem>
              <SelectItem value="month">{t('last30days')}</SelectItem>
              <SelectItem value="year">{t('lastYear')}</SelectItem>
              <SelectItem value="custom">{t('custom')}</SelectItem>
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
                    {startDate ? format(startDate, 'PPP') : t('startDate')}
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
                    {endDate ? format(endDate, 'PPP') : t('endDate')}
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
          {t('exportCSV')}
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalRevenue')}</CardTitle>
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
            <CardTitle className="text-sm font-medium">{t('bookingsCard')}</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overviewLoading ? '...' : overview?.totalBookings || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('confirmedBookings', { count: overview?.confirmedBookings || 0 })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('avgTicket')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overviewLoading ? '...' : `${currencySymbol} ${overview?.averageTicket?.toFixed(2) || '0.00'}`}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{t('perBooking')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('uniqueClients')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {overviewLoading ? '...' : overview?.uniqueClients || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('cancellationRate', { rate: overview?.cancelledRate?.toFixed(1) || '0' })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">{t('revenueTab')}</TabsTrigger>
          <TabsTrigger value="services">{t('servicesTab')}</TabsTrigger>
          <TabsTrigger value="clients">{t('clientsTab')}</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('revenueTitle')}</CardTitle>
              <CardDescription>{t('revenueDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <RevenueChart period={period} startDate={startDate} endDate={endDate} currency={currency} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('servicesTitle')}</CardTitle>
              <CardDescription>{t('servicesDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ServicesRanking period={period} startDate={startDate} endDate={endDate} currency={currency} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('clientsTitle')}</CardTitle>
              <CardDescription>{t('clientsDesc')}</CardDescription>
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
