'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Mail, MailX, MailCheck, MessageSquare } from 'lucide-react';

interface NotificationLog {
  id: string;
  channel: string;
  type: string;
  recipient: string;
  message: string;
  status: string;
  error_message: string | null;
  booking_id: string | null;
  created_at: string;
}

interface EmailNotificationsManagerProps {
  logs: NotificationLog[];
  professionalId: string;
}

type Filter = 'all' | 'sent' | 'failed' | 'pending';

export function EmailNotificationsManager({ logs }: EmailNotificationsManagerProps) {
  const t = useTranslations('notificationsPage');
  const locale = useLocale();
  const [retrying, setRetrying] = useState<string | null>(null);
  const [localLogs, setLocalLogs] = useState<NotificationLog[]>(logs);
  const [filter, setFilter] = useState<Filter>('all');

  const total = localLogs.length;
  const sent = localLogs.filter((l) => l.status === 'sent' || l.status === 'delivered').length;
  const failed = localLogs.filter((l) => l.status === 'failed').length;
  const pending = localLogs.filter((l) => l.status !== 'sent' && l.status !== 'delivered' && l.status !== 'failed').length;
  const failureRate = total > 0 ? ((failed / total) * 100).toFixed(1) : '0.0';
  const highFailureRate = parseFloat(failureRate) >= 30;

  const typeLabel = (type: string) => {
    const map: Record<string, string> = {
      booking_confirmation: t('typeConfirmation'),
      reminder: t('typeReminder'),
      cancellation: t('typeCancellation'),
      loyalty_reward: t('typeLoyalty'),
      waitlist_available: t('typeWaitlist'),
    };
    return map[type] ?? type;
  };

  const filteredLogs = localLogs.filter((l) => {
    if (filter === 'sent') return l.status === 'sent' || l.status === 'delivered';
    if (filter === 'failed') return l.status === 'failed';
    if (filter === 'pending') return l.status !== 'sent' && l.status !== 'delivered' && l.status !== 'failed';
    return true;
  });

  async function handleRetry(log: NotificationLog) {
    if (!log.booking_id) return;
    setRetrying(log.id);
    try {
      const res = await fetch('/api/notifications/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_id: log.id }),
      });

      if (res.ok) {
        setLocalLogs((prev) =>
          prev.map((l) =>
            l.id === log.id ? { ...l, status: 'sent', error_message: null } : l,
          ),
        );
      } else {
        const data = await res.json();
        alert(`${t('retryErrorMsg')}: ${data.error ?? ''}`);
      }
    } finally {
      setRetrying(null);
    }
  }

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: t('filterAll') },
    { key: 'sent', label: t('filterSent') },
    { key: 'failed', label: t('filterFailed') },
    { key: 'pending', label: t('filterPending') },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {/* Alerta de taxa alta */}
      {highFailureRate && failed > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <MailX className="h-4 w-4 shrink-0" />
          <span>{t('highFailureAlert', { rate: failureRate })}</span>
        </div>
      )}

      {/* Estatísticas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">{t('statsTotal')}</p>
            <p className="text-2xl font-bold">{total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">{t('statsSent')}</p>
            <p className="text-2xl font-bold text-green-600">{sent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">{t('statsFailed')}</p>
            <p className="text-2xl font-bold text-destructive">{failed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">{t('statsFailureRate')}</p>
            <p className={`text-2xl font-bold ${highFailureRate ? 'text-destructive' : 'text-foreground'}`}>
              {failureRate}%
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Lista */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">{t('historyTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {localLogs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Mail className="h-8 w-8" />
              <p className="text-sm">{t('noLogs')}</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Mail className="h-8 w-8" />
              <p className="text-sm">{t('noLogsFiltered')}</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredLogs.map((log) => (
                <div key={log.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={log.status} t={t} />
                      <span className="text-xs text-muted-foreground">
                        {typeLabel(log.type)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {log.channel === 'whatsapp' ? t('channelWhatsapp') : t('channelEmail')}
                      </span>
                    </div>
                    <p className="truncate text-sm font-medium">{log.recipient}</p>
                    {log.error_message && (
                      <p className="text-xs text-destructive">{log.error_message}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.created_at).toLocaleString(locale)}
                    </p>
                  </div>

                  {log.status === 'failed' && log.booking_id && log.channel === 'email' && (
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
                      {t('retry')}
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

function StatusBadge({ status, t }: { status: string; t: ReturnType<typeof useTranslations<'notificationsPage'>> }) {
  if (status === 'sent') {
    return (
      <Badge variant="outline" className="border-green-500 text-green-600">
        <MailCheck className="mr-1 h-3 w-3" />
        {t('statusSent')}
      </Badge>
    );
  }
  if (status === 'delivered') {
    return (
      <Badge variant="outline" className="border-green-500 text-green-600">
        <MailCheck className="mr-1 h-3 w-3" />
        {t('statusDelivered')}
      </Badge>
    );
  }
  if (status === 'failed') {
    return (
      <Badge variant="outline" className="border-destructive text-destructive">
        <MailX className="mr-1 h-3 w-3" />
        {t('statusFailed')}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary">
      <MessageSquare className="mr-1 h-3 w-3" />
      {t('statusPending')}
    </Badge>
  );
}
