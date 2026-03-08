'use client';

import { useState } from 'react';

interface CronLog {
  id: string;
  job_name: string;
  status: string;
  records_processed?: number;
  records_failed?: number;
  execution_time_ms?: number;
  error_message?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface ConnectivityResult {
  status: 'ok' | 'error' | 'skipped';
  latency_ms?: number;
  error?: string;
}

interface HealthResponse {
  status: string;
  connectivity: Record<string, ConnectivityResult>;
  connectivity_failures: string[];
  critical_missing: string[];
  timestamp: string;
}

interface Props {
  cronLogs: CronLog[];
  webhookFailures: CronLog[];
}

const SERVICE_LABELS: Record<string, string> = {
  supabase: 'Supabase (DB)',
  redis: 'Redis (Cache)',
  evolution_api: 'Evolution API (WhatsApp)',
  stripe: 'Stripe (Pagamentos)',
};

export function StatusDashboard({ cronLogs, webhookFailures }: Props) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runHealthCheck() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/health-check');
      if (!res.ok) {
        setError(`Erro: HTTP ${res.status}`);
        return;
      }
      const data = await res.json();
      setHealth(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // Group cron logs by job_name, show latest status
  const cronSummary = cronLogs.reduce<Record<string, { latest: CronLog; total: number; failures: number }>>((acc, log) => {
    if (!acc[log.job_name]) {
      acc[log.job_name] = { latest: log, total: 0, failures: 0 };
    }
    acc[log.job_name].total++;
    if (log.status === 'error') acc[log.job_name].failures++;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Service Health */}
      <section className="bg-white dark:bg-slate-900 rounded-lg border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Saúde dos Serviços</h2>
          <button
            onClick={runHealthCheck}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? 'Verificando...' : 'Executar Health Check'}
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-red-700 dark:text-red-400 text-sm mb-4">
            {error}
          </div>
        )}

        {health ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(health.connectivity).map(([service, result]) => (
              <div
                key={service}
                className={`p-4 rounded-lg border-2 ${
                  result.status === 'ok'
                    ? 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20'
                    : result.status === 'error'
                    ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20'
                    : 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/20'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`h-3 w-3 rounded-full ${
                      result.status === 'ok'
                        ? 'bg-green-500'
                        : result.status === 'error'
                        ? 'bg-red-500'
                        : 'bg-gray-400'
                    }`}
                  />
                  <span className="font-medium text-sm">
                    {SERVICE_LABELS[service] || service}
                  </span>
                </div>
                {result.latency_ms !== undefined && (
                  <p className="text-xs text-muted-foreground">{result.latency_ms}ms</p>
                )}
                {result.error && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 truncate" title={result.error}>
                    {result.error}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Clique em &quot;Executar Health Check&quot; para verificar a conectividade dos serviços.
          </p>
        )}

        {health && (
          <div className="mt-4 flex items-center gap-2">
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                health.status === 'healthy'
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}
            >
              {health.status === 'healthy' ? 'Todos os serviços operacionais' : 'Serviços com falha'}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(health.timestamp).toLocaleString('pt-BR')}
            </span>
          </div>
        )}
      </section>

      {/* Cron Logs (últimas 24h) */}
      <section className="bg-white dark:bg-slate-900 rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Cron Jobs (últimas 24h)</h2>
        {Object.keys(cronSummary).length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum log de cron nas últimas 24h.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 font-medium">Job</th>
                  <th className="pb-2 font-medium">Último Status</th>
                  <th className="pb-2 font-medium">Execuções</th>
                  <th className="pb-2 font-medium">Falhas</th>
                  <th className="pb-2 font-medium">Última Execução</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(cronSummary).map(([jobName, data]) => (
                  <tr key={jobName} className="border-b last:border-0">
                    <td className="py-2 font-mono text-xs">{jobName}</td>
                    <td className="py-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                          data.latest.status === 'success'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          data.latest.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                        {data.latest.status}
                      </span>
                    </td>
                    <td className="py-2">{data.total}</td>
                    <td className="py-2">
                      {data.failures > 0 ? (
                        <span className="text-red-600 font-medium">{data.failures}</span>
                      ) : (
                        '0'
                      )}
                    </td>
                    <td className="py-2 text-muted-foreground text-xs">
                      {new Date(data.latest.created_at).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Webhook Failures (últimas 24h) */}
      <section className="bg-white dark:bg-slate-900 rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Falhas de Webhooks (últimas 24h)</h2>
        {webhookFailures.length === 0 ? (
          <p className="text-sm text-green-600 dark:text-green-400">Nenhuma falha de webhook nas últimas 24h.</p>
        ) : (
          <div className="space-y-3">
            {webhookFailures.map((failure) => (
              <div
                key={failure.id}
                className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-xs font-medium">
                    {failure.job_name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(failure.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>
                {failure.error_message && (
                  <p className="text-sm text-red-700 dark:text-red-400">{failure.error_message}</p>
                )}
                {failure.metadata && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Evento: {(failure.metadata as any).event_type || 'N/A'} | ID: {(failure.metadata as any).event_id || 'N/A'}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
