'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Mail, MailX, MailCheck } from 'lucide-react';

interface EmailLog {
  id: string;
  type: string;
  recipient: string;
  message: string;
  status: string;
  error_message: string | null;
  booking_id: string | null;
  created_at: string;
}

interface EmailNotificationsManagerProps {
  logs: EmailLog[];
  professionalId: string;
}

const TYPE_LABELS: Record<string, string> = {
  booking_confirmation: 'Confirmação',
  reminder: 'Lembrete',
  cancellation: 'Cancelamento',
  loyalty_reward: 'Fidelidade',
  waitlist_available: 'Lista de espera',
};

export function EmailNotificationsManager({ logs }: EmailNotificationsManagerProps) {
  const [retrying, setRetrying] = useState<string | null>(null);
  const [localLogs, setLocalLogs] = useState<EmailLog[]>(logs);

  const total = localLogs.length;
  const sent = localLogs.filter((l) => l.status === 'sent' || l.status === 'delivered').length;
  const failed = localLogs.filter((l) => l.status === 'failed').length;
  const failureRate = total > 0 ? ((failed / total) * 100).toFixed(1) : '0.0';
  const highFailureRate = parseFloat(failureRate) >= 30;

  async function handleRetry(log: EmailLog) {
    if (!log.booking_id) return;
    setRetrying(log.id);
    try {
      const res = await fetch('/api/notifications/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_id: log.id }),
      });

      if (res.ok) {
        // Marcar como "reenviado" localmente (status real vem de novo log inserido)
        setLocalLogs((prev) =>
          prev.map((l) =>
            l.id === log.id ? { ...l, status: 'sent', error_message: null } : l,
          ),
        );
      } else {
        const data = await res.json();
        alert(`Erro ao reenviar: ${data.error ?? 'Erro desconhecido'}`);
      }
    } finally {
      setRetrying(null);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Notificações por Email</h1>

      {/* Alerta de taxa alta */}
      {highFailureRate && failed > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <MailX className="h-4 w-4 shrink-0" />
          <span>
            Taxa de falha de <strong>{failureRate}%</strong> nos últimos 30 dias. Verifique a
            configuração de email ou reenvie os emails falhados.
          </span>
        </div>
      )}

      {/* Estatísticas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total (30d)</p>
            <p className="text-2xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Enviados</p>
            <p className="text-2xl font-bold text-green-600">{sent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Falhados</p>
            <p className="text-2xl font-bold text-destructive">{failed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Taxa de falha</p>
            <p
              className={`text-2xl font-bold ${highFailureRate ? 'text-destructive' : 'text-foreground'}`}
            >
              {failureRate}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Histórico de emails</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {localLogs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Mail className="h-8 w-8" />
              <p className="text-sm">Nenhum email registrado nos últimos 30 dias</p>
            </div>
          ) : (
            <div className="divide-y">
              {localLogs.map((log) => (
                <div key={log.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={log.status} />
                      <span className="text-xs text-muted-foreground">
                        {TYPE_LABELS[log.type] ?? log.type}
                      </span>
                    </div>
                    <p className="truncate text-sm font-medium">{log.recipient}</p>
                    {log.error_message && (
                      <p className="text-xs text-destructive">{log.error_message}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>

                  {log.status === 'failed' && log.booking_id && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 shrink-0 sm:mt-0"
                      onClick={() => handleRetry(log)}
                      disabled={retrying === log.id}
                    >
                      {retrying === log.id ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-1 h-3 w-3" />
                      )}
                      Reenviar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'sent' || status === 'delivered') {
    return (
      <Badge variant="outline" className="border-green-500 text-green-600">
        <MailCheck className="mr-1 h-3 w-3" />
        {status === 'delivered' ? 'Entregue' : 'Enviado'}
      </Badge>
    );
  }
  if (status === 'failed') {
    return (
      <Badge variant="outline" className="border-destructive text-destructive">
        <MailX className="mr-1 h-3 w-3" />
        Falhou
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">{status}</Badge>
  );
}
