'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Calendar,
  MessageCircle,
  Instagram,
  Mail,
  CreditCard,
  MapPin,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Loader2
} from 'lucide-react';

interface Integration {
  integration_type: string;
  is_active: boolean;
  is_configured: boolean;
  last_sync_at?: string;
  last_error?: string;
  settings?: any;
}

interface IntegrationsManagerProps {
  professional: any;
  integrations: Integration[];
}

export function IntegrationsManager({ professional, integrations }: IntegrationsManagerProps) {
  const t = useTranslations('integrations');
  const locale = useLocale();
  const [loading, setLoading] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);

  const INTEGRATION_CONFIGS = {
    google_calendar: {
      name: 'Google Calendar',
      description: t('googleCalendarDesc'),
      icon: Calendar,
      color: 'blue',
      canConnect: true,
    },
    whatsapp_api: {
      name: 'WhatsApp Business API',
      description: t('whatsappApiDesc'),
      icon: MessageCircle,
      color: 'green',
      canConnect: false,
    },
    instagram: {
      name: 'Instagram',
      description: t('instagramDesc'),
      icon: Instagram,
      color: 'pink',
      canConnect: true,
    },
    email_marketing: {
      name: 'Email Marketing',
      description: t('emailMarketingDesc'),
      icon: Mail,
      color: 'purple',
      canConnect: true,
    },
    google_maps: {
      name: 'Google Maps',
      description: t('googleMapsDesc'),
      icon: MapPin,
      color: 'red',
      canConnect: true,
    },
    revolut: {
      name: 'Revolut Business',
      description: t('revolutDesc'),
      icon: CreditCard,
      color: 'gray',
      canConnect: true,
    },
  };

  // Transformar array em map
  const integrationsMap: Record<string, Integration> = {};
  integrations.forEach((int) => {
    integrationsMap[int.integration_type] = int;
  });

  const handleConnect = async (type: string) => {
    if (type === 'google_calendar') {
      window.location.href = '/api/integrations/google-calendar/connect';
    } else if (type === 'instagram') {
      window.location.href = '/api/integrations/instagram/connect';
    } else if (type === 'email_marketing') {
      window.location.href = '/email-campaigns';
    } else if (type === 'revolut') {
      window.location.href = '/settings?tab=payment';
    } else if (type === 'google_maps') {
      window.location.href = '/settings?tab=location';
    }
  };

  const handleDisconnect = async (type: string) => {
    if (!confirm(t('confirmDisconnect'))) {
      return;
    }

    setLoading(type);

    try {
      const res = await fetch(`/api/integrations/${type}/disconnect`, {
        method: 'POST',
      });

      if (res.ok) {
        window.location.reload();
      } else {
        alert(t('disconnectError'));
      }
    } catch {
      alert(t('disconnectError'));
    } finally {
      setLoading(null);
    }
  };

  const handleToggle = async (type: string, newState: boolean) => {
    setLoading(type);

    try {
      const res = await fetch(`/api/integrations/${type}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newState }),
      });

      if (res.ok) {
        window.location.reload();
      } else {
        alert(t('updateError'));
      }
    } catch {
      alert(t('updateError'));
    } finally {
      setLoading(null);
    }
  };

  const handleSync = async (type: string) => {
    setSyncing(type);

    try {
      const res = await fetch(`/api/integrations/${type}/sync`, {
        method: 'POST',
      });

      const data = await res.json();

      if (res.ok) {
        alert(`${t('syncSuccess')}\n${JSON.stringify(data.result, null, 2)}`);
        window.location.reload();
      } else {
        alert(t('syncError', { message: data.message || 'Sync failed' }));
      }
    } catch {
      alert(t('syncError', { message: 'Network error' }));
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-gray-600 mt-1">{t('subtitle')}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {Object.entries(INTEGRATION_CONFIGS).map(([type, config]) => {
          const integration = integrationsMap[type];
          const Icon = config.icon;

          return (
            <Card key={type} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <div className={`p-3 bg-${config.color}-100 rounded-lg`}>
                    <Icon className={`w-6 h-6 text-${config.color}-600`} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{config.name}</h3>
                    <p className="text-sm text-gray-600">{config.description}</p>
                  </div>
                </div>

                {integration?.is_configured && (
                  <Switch
                    checked={integration.is_active}
                    onCheckedChange={(checked) => handleToggle(type, checked)}
                    disabled={loading === type}
                  />
                )}
              </div>

              <div className="flex items-center gap-2 mb-4">
                {integration?.is_configured ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-sm text-green-600 font-medium">{t('connected')}</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-orange-600" />
                    <span className="text-sm text-orange-600 font-medium">{t('notConfigured')}</span>
                  </>
                )}
              </div>

              {integration?.last_sync_at && (
                <p className="text-xs text-gray-500 mb-4">
                  {t('lastSync')}{' '}
                  {new Date(integration.last_sync_at).toLocaleString(locale)}
                </p>
              )}

              {integration?.last_error && (
                <div className="mb-4 p-3 bg-red-50 rounded-lg">
                  <p className="text-xs text-red-600">
                    {t('syncError', { message: integration.last_error })}
                  </p>
                </div>
              )}

              {!integration?.is_configured ? (
                <Button
                  onClick={() => handleConnect(type)}
                  className="w-full"
                  disabled={!config.canConnect || loading === type}
                >
                  {loading === type ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('connecting')}
                    </>
                  ) : config.canConnect ? (
                    t('connect', { name: config.name })
                  ) : (
                    t('comingSoon')
                  )}
                </Button>
              ) : (
                <div className="flex gap-2">
                  {type === 'google_calendar' && (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleSync(type)}
                      disabled={syncing === type}
                    >
                      {syncing === type ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {t('syncing')}
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          {t('sync')}
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    className={type === 'google_calendar' ? 'flex-1' : 'w-full'}
                    onClick={() => handleDisconnect(type)}
                    disabled={loading === type}
                  >
                    {loading === type ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t('disconnecting')}
                      </>
                    ) : (
                      t('disconnect')
                    )}
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Instruções */}
      <Card className="mt-8 p-6 bg-blue-50">
        <h3 className="text-lg font-semibold mb-2">{t('howTitle')}</h3>
        <div className="space-y-2 text-sm text-gray-700">
          <p>
            <strong>Google Calendar:</strong> {t('howGoogleCalendar')}
          </p>
          <p>
            <strong>WhatsApp Business API:</strong> {t('howWhatsApp')}
          </p>
          <p>
            <strong>Outras integrações:</strong> {t('howOthers')}
          </p>
        </div>
      </Card>
    </div>
  );
}
