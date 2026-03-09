'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card } from '@/components/ui/card';
import {
  Clock,
  Bell,
  CheckCircle2,
  MessageSquare
} from 'lucide-react';

interface AutomationsManagerProps {
  professional: any;
  cronLogs: any[];
  notificationLogs: any[];
  stats: {
    totalNotifications: number;
    pendingQueue: number;
  };
}

export function AutomationsManager({
  notificationLogs,
  stats,
}: AutomationsManagerProps) {
  const t = useTranslations('automations');
  const locale = useLocale();
  const [activeTab, setActiveTab] = useState<'overview' | 'notifications'>('overview');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Bell className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            <div>
              <p className="text-sm text-muted-foreground">{t('totalNotifications')}</p>
              <p className="text-2xl font-bold">{stats.totalNotifications}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-orange-600 dark:text-orange-400" />
            <div>
              <p className="text-sm text-muted-foreground">{t('inQueue')}</p>
              <p className="text-2xl font-bold">{stats.pendingQueue}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-2 px-1 border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('tabOverview')}
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`pb-2 px-1 border-b-2 transition-colors ${
              activeTab === 'notifications'
                ? 'border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t('tabNotifications')}
          </button>
        </nav>
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">{t('systemStatus')}</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="font-medium">{t('autoReminders')}</span>
                </div>
                <span className="text-sm text-green-600 dark:text-green-400">{t('active')}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="font-medium">{t('autoConfirmations')}</span>
                </div>
                <span className="text-sm text-green-600 dark:text-green-400">{t('active')}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="font-medium">{t('waitlist')}</span>
                </div>
                <span className="text-sm text-green-600 dark:text-green-400">{t('active')}</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">{t('nextRuns')}</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">{t('sendReminders')}</span>
                <span className="font-medium">{t('todayAt10')}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">{t('updateAnalytics')}</span>
                <span className="font-medium">{t('tomorrowAt0')}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">{t('cleanTokens')}</span>
                <span className="font-medium">{t('todayAt2')}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Notification Logs */}
      {activeTab === 'notifications' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">{t('notificationsHistory')}</h3>
          {notificationLogs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
              <Bell className="h-8 w-8" />
              <p className="text-sm">{t('noNotifications')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notificationLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    <div>
                      <p className="font-medium">{log.type}</p>
                      <p className="text-sm text-muted-foreground">
                        {log.recipient} · {new Date(log.created_at).toLocaleString(locale)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      log.status === 'sent'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                    }`}
                  >
                    {log.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
