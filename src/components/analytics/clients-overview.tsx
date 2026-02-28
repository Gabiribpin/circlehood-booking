'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, TrendingUp, AlertCircle, Download } from 'lucide-react';
import { exportClientsToCSV } from '@/lib/analytics/export-csv';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ClientsOverviewProps {
  currency: string;
}

const currencySymbols: Record<string, string> = { EUR: '€', GBP: '£', USD: '$', BRL: 'R$' };

export function ClientsOverview({ currency }: ClientsOverviewProps) {
  const t = useTranslations('analytics');
  const sym = currencySymbols[currency?.toUpperCase()] ?? currency;

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'clients'],
    queryFn: async () => {
      const res = await fetch('/api/analytics/clients?limit=20');
      if (!res.ok) throw new Error('Failed to fetch clients');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="h-[400px] flex items-center justify-center">
        <p className="text-muted-foreground">{t('loadingClients')}</p>
      </div>
    );
  }

  const stats = data?.stats || {};
  const clients = data?.clients || [];

  const typeLabels: Record<string, string> = {
    new: t('typeNew'),
    occasional: t('typeOccasional'),
    recurring: t('typeRecurring'),
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('totalClients')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total || 0}</div>
            <div className="flex gap-2 mt-2 text-xs">
              <Badge variant="secondary">{stats.byType?.new || 0} {t('typeNew')}</Badge>
              <Badge variant="secondary">{stats.byType?.recurring || 0} {t('typeRecurring')}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('activeClients')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byEngagement?.active || 0}</div>
            <p className="text-xs text-muted-foreground mt-2">{t('activeClientsDesc')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('atRisk')}</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byEngagement?.at_risk || 0}</div>
            <p className="text-xs text-muted-foreground mt-2">{t('atRiskDesc')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Client Lists */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => data && exportClientsToCSV(data)}
          disabled={!data || clients.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          {t('exportCSV')}
        </Button>
      </div>
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">{t('filterAll')}</TabsTrigger>
          <TabsTrigger value="active">{t('filterActive')}</TabsTrigger>
          <TabsTrigger value="at_risk">{t('filterAtRisk')}</TabsTrigger>
          <TabsTrigger value="churned">{t('filterInactive')}</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <ClientTable clients={clients} sym={sym} t={t} typeLabels={typeLabels} />
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          <ClientTable clients={clients.filter((c: any) => c.engagement_status === 'active')} sym={sym} t={t} typeLabels={typeLabels} />
        </TabsContent>

        <TabsContent value="at_risk" className="space-y-4">
          <ClientTable clients={clients.filter((c: any) => c.engagement_status === 'at_risk')} sym={sym} t={t} typeLabels={typeLabels} />
        </TabsContent>

        <TabsContent value="churned" className="space-y-4">
          <ClientTable clients={clients.filter((c: any) => c.engagement_status === 'churned')} sym={sym} t={t} typeLabels={typeLabels} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ClientTable({
  clients,
  sym,
  t,
  typeLabels,
}: {
  clients: any[];
  sym: string;
  t: ReturnType<typeof useTranslations<'analytics'>>;
  typeLabels: Record<string, string>;
}) {
  if (clients.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center">
        <p className="text-muted-foreground">{t('noClientsCategory')}</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('colClient')}</TableHead>
          <TableHead>{t('colType')}</TableHead>
          <TableHead className="text-right">{t('colBookingsHeader')}</TableHead>
          <TableHead className="text-right">{t('colLTV')}</TableHead>
          <TableHead className="text-right">{t('avgTicket')}</TableHead>
          <TableHead className="text-right">{t('colLastBooking')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.map((client: any) => (
          <TableRow key={client.client_phone}>
            <TableCell>
              <div>
                <p className="font-medium">{client.client_name}</p>
                <p className="text-xs text-muted-foreground">{client.client_phone}</p>
              </div>
            </TableCell>
            <TableCell>
              <Badge
                variant={
                  client.client_type === 'recurring'
                    ? 'default'
                    : client.client_type === 'occasional'
                      ? 'secondary'
                      : 'outline'
                }
              >
                {typeLabels[client.client_type] ?? client.client_type}
              </Badge>
            </TableCell>
            <TableCell className="text-right">{client.total_bookings}</TableCell>
            <TableCell className="text-right font-semibold">
              {sym} {Number(client.lifetime_value || 0).toFixed(2)}
            </TableCell>
            <TableCell className="text-right">
              {sym} {Number(client.avg_ticket || 0).toFixed(2)}
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {t('daysAgo', { n: client.days_since_last_booking })}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
