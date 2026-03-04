import { createAdminClient } from '@/lib/supabase/admin';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, CheckCircle, XCircle, AlertTriangle, RotateCcw, Skull } from 'lucide-react';
import { WebhookRetryButton } from '@/components/admin/webhook-retry-button';

export default async function WebhookFailuresPage() {
  const supabase = createAdminClient();

  const [failuresResult, countsResult] = await Promise.allSettled([
    supabase
      .from('webhook_failures')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('webhook_failures')
      .select('status'),
  ]);

  const failures = failuresResult.status === 'fulfilled' ? (failuresResult.value.data ?? []) : [];

  const counts = { pending: 0, retrying: 0, resolved: 0, dead_letter: 0, total: 0 };
  if (countsResult.status === 'fulfilled') {
    for (const f of countsResult.value.data ?? []) {
      counts.total++;
      const s = f.status as keyof typeof counts;
      if (s in counts) counts[s]++;
    }
  }

  const statusColors: Record<string, string> = {
    pending: 'text-amber-600 bg-amber-50',
    retrying: 'text-blue-600 bg-blue-50',
    resolved: 'text-green-600 bg-green-50',
    dead_letter: 'text-red-600 bg-red-50',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Webhook Failures</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fila de retry para webhooks que falharam (Stripe, Evolution API, Resend)
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pendente</p>
                <p className="text-3xl font-bold">{counts.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <RotateCcw className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Retrying</p>
                <p className="text-3xl font-bold">{counts.retrying}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Resolvidos</p>
                <p className="text-3xl font-bold">{counts.resolved}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <Skull className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Dead Letter</p>
                <p className="text-3xl font-bold">{counts.dead_letter}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                <AlertTriangle className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-3xl font-bold">{counts.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Failures Table */}
      {failures.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhuma falha de webhook registrada.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-5">
            <h2 className="text-lg font-semibold mb-4">Últimas Falhas ({failures.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Tipo</th>
                    <th className="pb-2 pr-4">Evento</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2 pr-4">Tentativas</th>
                    <th className="pb-2 pr-4">Erro</th>
                    <th className="pb-2 pr-4">Criado em</th>
                    <th className="pb-2 pr-4">Próximo Retry</th>
                    <th className="pb-2">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {failures.map((f: any) => (
                    <tr key={f.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs">{f.webhook_type}</td>
                      <td className="py-2 pr-4 text-xs">{f.event_type ?? '—'}</td>
                      <td className="py-2 pr-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[f.status] || ''}`}>
                          {f.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-center">{f.attempt_count}/{f.max_attempts}</td>
                      <td className="py-2 pr-4 text-xs text-red-500 max-w-[200px] truncate" title={f.error}>
                        {f.error ?? '—'}
                      </td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground">
                        {new Date(f.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground">
                        {f.next_retry_at
                          ? new Date(f.next_retry_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                          : '—'}
                      </td>
                      <td className="py-2">
                        {(f.status === 'dead_letter' || f.status === 'pending' || f.status === 'retrying') && (
                          <WebhookRetryButton failureId={f.id} />
                        )}
                      </td>
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
