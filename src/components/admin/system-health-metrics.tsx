'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw } from 'lucide-react';

interface WebhookLog {
  id: string;
  created_at: string;
  instance_name: string;
  status: number;
  error: string | null;
  processing_time_ms: number | null;
  rate_limited: boolean;
}

interface HealthMetrics {
  timestamp: string;
  redis: { status: string; active_limits: number };
  webhooks: {
    recent: WebhookLog[];
    total_24h: number;
    success_rate_24h: number;
    avg_processing_ms: number;
  };
  whatsapp: {
    total_connections: number;
    bot_enabled_count: number;
    connections: Array<{
      evolution_instance: string;
      bot_enabled: boolean;
      is_active: boolean;
    }>;
  };
}

export function SystemHealthMetrics() {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30_000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando System Health...
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
        Erro ao carregar System Health: {error ?? 'dados indisponveis'}
      </div>
    );
  }

  const successPct = (metrics.webhooks.success_rate_24h * 100).toFixed(1);
  const successColor =
    metrics.webhooks.success_rate_24h >= 0.95
      ? 'text-green-600'
      : metrics.webhooks.success_rate_24h >= 0.8
        ? 'text-amber-600'
        : 'text-red-500';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">System Health</h2>
        <button
          onClick={() => { setLoading(true); fetchMetrics(); }}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Atualizar"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Redis</p>
            <p className="text-2xl font-bold mt-1">
              {metrics.redis.status === 'ok'
                ? '🟢'
                : metrics.redis.status === 'not_configured'
                  ? '⚪'
                  : '🔴'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.redis.active_limits} rate limits ativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Webhook Success (24h)</p>
            <p className={`text-2xl font-bold mt-1 ${successColor}`}>
              {metrics.webhooks.total_24h > 0 ? `${successPct}%` : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.webhooks.total_24h} requests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Avg Processing</p>
            <p className="text-2xl font-bold mt-1">
              {metrics.webhooks.avg_processing_ms}ms
            </p>
            <p className="text-xs text-muted-foreground mt-1">tempo medio</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">WhatsApp Ativo</p>
            <p className="text-2xl font-bold mt-1">
              {metrics.whatsapp.bot_enabled_count}/{metrics.whatsapp.total_connections}
            </p>
            <p className="text-xs text-muted-foreground mt-1">bot ligado / conectados</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent webhooks table */}
      {metrics.webhooks.recent.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Webhooks Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4 font-medium text-muted-foreground">Hora</th>
                    <th className="py-2 pr-4 font-medium text-muted-foreground">Instance</th>
                    <th className="py-2 pr-4 font-medium text-muted-foreground">Status</th>
                    <th className="py-2 font-medium text-muted-foreground">Tempo</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.webhooks.recent.slice(0, 10).map((w) => (
                    <tr key={w.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 text-muted-foreground">
                        {new Date(w.created_at).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">{w.instance_name}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={w.status === 200 ? 'default' : 'destructive'}>
                          {w.status}
                        </Badge>
                        {w.rate_limited && (
                          <Badge variant="outline" className="ml-1">
                            rate-limited
                          </Badge>
                        )}
                      </td>
                      <td className="py-2">{w.processing_time_ms ?? '—'}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
