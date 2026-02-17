'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Globe, MessageSquare, MapPin, Euro } from 'lucide-react';

interface ContactStatsProps {
  stats: {
    total: number;
    byNationality: Record<string, number>;
    byLanguage: Record<string, number>;
    byZone: Record<string, number>;
    avgTotalSpent: number;
    totalRevenue: number;
  };
}

export function ContactStats({ stats }: ContactStatsProps) {
  const topNationalities = Object.entries(stats.byNationality)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  const topLanguages = Object.entries(stats.byLanguage)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const topZones = Object.entries(stats.byZone)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Contatos</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Top Nacionalidades</CardTitle>
          <Globe className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {topNationalities.map(([code, count]) => (
              <div key={code} className="flex justify-between text-sm">
                <span>{code}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Idiomas</CardTitle>
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {topLanguages.map(([code, count]) => (
              <div key={code} className="flex justify-between text-sm">
                <span className="uppercase">{code}</span>
                <span className="font-medium">{count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
          <Euro className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">€{stats.totalRevenue.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">
            Média: €{stats.avgTotalSpent.toFixed(2)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
