'use client';

import { useState, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Mail, CheckCircle2, XCircle, Clock } from 'lucide-react';

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

type TimeFilter = 'today' | 'week' | 'failures';

export function EmailNotificationsManager({ logs }: EmailNotificationsManagerProps) {
  const t = useTranslations('notificationsPage');
  const locale = useLocale();
  const [retrying, setRetrying] = useState<string | null>(null);
  const [localLogs, setLocalLogs] = useState<NotificationLog[]>(logs);
  const [filter, setFilter] = useState<TimeFilter>('today');

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  const filteredLogs = useMemo(() => {
    return localLogs.filter((l) => {
      const date = new Date(l.created_at);
      if (filter === 'today') return date >= todayStart;
      if (filter === 'week') return date >= weekStart;
      if (filter === 'failures') return l.status === 'failed';
      return true;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localLogs, filter]);

  const sent = localLogs.filter((l) => l.status === 'sent' || l.status === 'delivered').length;
  const failed = localLogs.filter((l) => l.status === 'failed').length;

  const typeLabel = (type: string) => {
    const map: Record<string, string> = {
      booking_confirmation: t('typeConfirmation'),
      reminder: t('typeReminder'),
      reminder_24h: t('typeReminder'),
      cancellation: t('typeCancellation'),
      loyalty_reward: t('typeLoyalty'),
      waitlist_available: t('typeWaitlist'),
    };
    return map[type] ?? type;
  };

  const channelLabel = (channel: string) =>
    channel === 'whatsapp' ? 'WhatsApp' : 'Email';

  function friendlyMessage(log: NotificationLog): string {
    const channel = channelLabel(log.channel);
    const type = typeLabel(log.type).toLowerCase();
    const recipient = log.recipient;

    if (log.status === 'failed') {
      const reason = log.error_message
        ? ` (${t('feedErrorReason', { reason: simplifyError(log.error_message) })})`
        : '';
      return t('feedFailed', { type, recipient, channel }) + reason;
    }

    return t('feedSent', { type, recipient, channel });
  }

  function simplifyError(err: string): string {
    if (/invalid.*email|email.*invalid/i.test(err)) return t('errorInvalidEmail');
    if (/bounce/i.test(err)) return t('errorBounced');
    if (/timeout/i.test(err)) return t('errorTimeout');
    if (/rate.?limit/i.test(err)) return t('errorRateLimit');
    if (/not.*found|404/i.test(err)) return t('errorNotFound');
    return err.length > 60 ? err.slice(0, 60) + '…' : err;
  }

  function relativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMs / 3600000);
    const diffD = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return t('timeJustNow');
    if (diffMin < 60) return t('timeMinutesAgo', { count: diffMin });
    if (diffH < 24) return t('timeHoursAgo', { count: diffH });
    if (diffD === 1) return t('timeYesterday');
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  }

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

  const FILTERS: { key: TimeFilter; label: string }[] = [
    { key: 'today', label: t('filterToday') },
    { key: 'week', label: t('filterWeek') },
    { key: 'failures', label: t('filterFailures') },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {/* Summary */}
      <div className="flex gap-4 text-sm">
        <span className="text-muted-foreground">
          {t('summaryDelivered', { count: sent })}
        </span>
        {failed > 0 && (
          <span className="text-destructive font-medium">
            {t('summaryFailed', { count: failed })}
          </span>
        )}
      </div>

      {/* Filters */}
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

      {/* Activity feed */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">{t('feedTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {localLogs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Mail className="h-8 w-8" />
              <p className="text-sm font-medium">{t('noLogs')}</p>
              <p className="text-xs text-center max-w-xs">{t('noLogsHint')}</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Mail className="h-8 w-8" />
              <p className="text-sm">{t('noLogsFiltered')}</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="mt-0.5 shrink-0">
                    {log.status === 'failed' ? (
                      <XCircle className="h-5 w-5 text-destructive" />
                    ) : log.status === 'sent' || log.status === 'delivered' ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <Clock className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{friendlyMessage(log)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {relativeTime(log.created_at)}
                    </p>
                  </div>
                  {log.status === 'failed' && log.booking_id && log.channel === 'email' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
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
