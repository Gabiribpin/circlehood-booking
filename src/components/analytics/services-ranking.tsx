'use client';

import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { exportServicesToCSV } from '@/lib/analytics/export-csv';

interface ServicesRankingProps {
  period: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  currency: string;
}

const currencySymbols: Record<string, string> = { EUR: '€', GBP: '£', USD: '$', BRL: 'R$' };

export function ServicesRanking({ period, startDate, endDate, limit = 10, currency }: ServicesRankingProps) {
  const sym = currencySymbols[currency] ?? currency;

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'services', 'ranking', period, limit, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({ period, limit: String(limit) });
      if (period === 'custom' && startDate && endDate) {
        params.append('startDate', format(startDate, 'yyyy-MM-dd'));
        params.append('endDate', format(endDate, 'yyyy-MM-dd'));
      }
      const res = await fetch(`/api/analytics/services/ranking?${params}`);
      if (!res.ok) throw new Error('Failed to fetch services ranking');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <p className="text-muted-foreground">Carregando serviços...</p>
      </div>
    );
  }

  const services = data?.services || [];

  if (services.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center">
        <p className="text-muted-foreground">Nenhum dado de serviços neste período</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => data && exportServicesToCSV(data)}
          disabled={!data || services.length === 0}
        >
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rank</TableHead>
            <TableHead>Serviço</TableHead>
            <TableHead className="text-right">Preço</TableHead>
            <TableHead className="text-right">Agendamentos</TableHead>
            <TableHead className="text-right">Receita</TableHead>
            <TableHead className="text-right">Média/Dia</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {services.map((service: any, index: number) => (
            <TableRow key={service.service_id}>
              <TableCell>
                <Badge variant={index === 0 ? 'default' : 'outline'}>#{index + 1}</Badge>
              </TableCell>
              <TableCell className="font-medium">{service.service_name}</TableCell>
              <TableCell className="text-right">
                {sym} {Number(service.service_price || 0).toFixed(2)}
              </TableCell>
              <TableCell className="text-right">{service.total_bookings}</TableCell>
              <TableCell className="text-right font-semibold">
                {sym} {Number(service.total_revenue || 0).toFixed(2)}
              </TableCell>
              <TableCell className="text-right text-muted-foreground">
                {Number(service.avg_bookings_per_day || 0).toFixed(1)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
