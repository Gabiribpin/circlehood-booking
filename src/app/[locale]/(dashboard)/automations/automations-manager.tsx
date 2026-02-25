'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Clock,
  Bell,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Calendar,
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
  professional,
  cronLogs,
  notificationLogs,
  stats,
}: AutomationsManagerProps) {
  const t = useTranslations('automations');
  const locale = useLocale();
  const [activeTab, setActiveTab] = useState<'overview' | 'cron' | 'notifications'>('overview');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-gray-600 mt-1">{t('subtitle')}</p>
      </div>

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Bell className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-sm text-gray-600">{t('totalNotifications')}</p>
              <p className="text-2xl font-bold">{stats.totalNotifications}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-orange-600" />
            <div>
              <p className="text-sm text-gray-600">{t('inQueue')}</p>
              <p className="text-2xl font-bold">{stats.pendingQueue}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">{t('cronOk')}</p>
              <p className="text-2xl font-bold">
                {cronLogs.filter((l) => l.status === 'success').length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <XCircle className="h-8 w-8 text-red-600" />
            <div>
              <p className="text-sm text-gray-600">{t('errors')}</p>
              <p className="text-2xl font-bold">
                {cronLogs.filter((l) => l.status === 'error').length}
              </p>
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
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {t('tabOverview')}
          </button>
          <button
            onClick={() => setActiveTab('cron')}
            className={`pb-2 px-1 border-b-2 transition-colors ${
              activeTab === 'cron'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {t('tabCron')}
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`pb-2 px-1 border-b-2 transition-colors ${
              activeTab === 'notifications'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
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
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-medium">{t('autoReminders')}</span>
                </div>
                <span className="text-sm text-green-600">{t('active')}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-medium">{t('autoConfirmations')}</span>
                </div>
                <span className="text-sm text-green-600">{t('active')}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-medium">{t('waitlist')}</span>
                </div>
                <span className="text-sm text-green-600">{t('active')}</span>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">{t('nextRuns')}</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">{t('sendReminders')}</span>
                <span className="font-medium">{t('todayAt10')}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">{t('updateAnalytics')}</span>
                <span className="font-medium">{t('tomorrowAt0')}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">{t('cleanTokens')}</span>
                <span className="font-medium">{t('todayAt2')}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Cron Logs */}
      {activeTab === 'cron' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">{t('cronHistory')}</h3>
          <div className="space-y-2">
            {cronLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {log.status === 'success' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-600" />
                  )}
                  <div>
                    <p className="font-medium">{log.job_name}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(log.created_at).toLocaleString(locale)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {t('processed', { count: log.records_processed })}
                  </p>
                  <p className="text-xs text-gray-500">{log.execution_time_ms}ms</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Notification Logs */}
      {activeTab === 'notifications' && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">{t('notificationsHistory')}</h3>
          <div className="space-y-2">
            {notificationLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-purple-600" />
                  <div>
                    <p className="font-medium">{log.type}</p>
                    <p className="text-sm text-gray-600">
                      {log.recipient} · {new Date(log.created_at).toLocaleString(locale)}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-1 rounded-full ${
                    log.status === 'sent'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {log.status}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
