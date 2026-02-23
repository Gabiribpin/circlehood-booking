'use client';

import { useQuery } from '@tanstack/react-query';
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

const clientTypeLabels: Record<string, string> = {
  new: 'novo',
  occasional: 'ocasional',
  recurring: 'recorrente',
};

export function ClientsOverview({ currency }: ClientsOverviewProps) {
  const sym = currencySymbols[currency] ?? currency;

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
        <p className="text-muted-foreground">Carregando clientes...</p>
      </div>
    );
  }

  const stats = data?.stats || {};
  const clients = data?.clients || [];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Clientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total || 0}</div>
            <div className="flex gap-2 mt-2 text-xs">
              <Badge variant="secondary">{stats.byType?.new || 0} novo</Badge>
              <Badge variant="secondary">{stats.byType?.recurring || 0} recorrente</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byEngagement?.active || 0}</div>
            <p className="text-xs text-muted-foreground mt-2">Agendaram nos últimos 30 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Risco</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byEngagement?.at_risk || 0}</div>
            <p className="text-xs text-muted-foreground mt-2">31-90 dias sem agendamento</p>
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
          Exportar CSV
        </Button>
      </div>
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="active">Ativos</TabsTrigger>
          <TabsTrigger value="at_risk">Em Risco</TabsTrigger>
          <TabsTrigger value="churned">Inativos</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <ClientTable clients={clients} sym={sym} />
        </TabsContent>

        <TabsContent value="active" className="space-y-4">
          <ClientTable clients={clients.filter((c: any) => c.engagement_status === 'active')} sym={sym} />
        </TabsContent>

        <TabsContent value="at_risk" className="space-y-4">
          <ClientTable clients={clients.filter((c: any) => c.engagement_status === 'at_risk')} sym={sym} />
        </TabsContent>

        <TabsContent value="churned" className="space-y-4">
          <ClientTable clients={clients.filter((c: any) => c.engagement_status === 'churned')} sym={sym} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ClientTable({ clients, sym }: { clients: any[]; sym: string }) {
  if (clients.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center">
        <p className="text-muted-foreground">Nenhum cliente nesta categoria</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cliente</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead className="text-right">Agendamentos</TableHead>
          <TableHead className="text-right">LTV</TableHead>
          <TableHead className="text-right">Ticket Médio</TableHead>
          <TableHead className="text-right">Último Agendamento</TableHead>
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
                {clientTypeLabels[client.client_type] ?? client.client_type}
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
              há {client.days_since_last_booking}d
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
