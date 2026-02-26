'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertTriangle, Loader2, ExternalLink, RefreshCw } from 'lucide-react';

export interface ConnectStatus {
  connected: boolean;
  stripe_account_id?: string;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  onboarding_complete?: boolean;
}

interface StripeConnectCardProps {
  status: ConnectStatus;
  currency: string;
}

export function StripeConnectCard({ status, currency: _currency }: StripeConnectCardProps) {
  const t = useTranslations('payment');
  const [loading, setLoading] = useState<string | null>(null);

  async function handleConnect() {
    setLoading('connect');
    try {
      const res = await fetch('/api/stripe/connect/create-account', { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(null);
    }
  }

  async function handleRefreshOnboarding() {
    setLoading('refresh');
    try {
      const res = await fetch('/api/stripe/connect/refresh-onboarding', { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(null);
    }
  }

  async function handleDashboard() {
    setLoading('dashboard');
    try {
      const res = await fetch('/api/stripe/connect/dashboard-link', { method: 'POST' });
      const data = await res.json();
      if (data.url) window.open(data.url, '_blank', 'noopener,noreferrer');
    } finally {
      setLoading(null);
    }
  }

  // Estado 1: não conectado
  if (!status.connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('connectTitle')}</CardTitle>
          <CardDescription>{t('connectDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">{t('platformFee')}</p>
          <Button onClick={handleConnect} disabled={loading === 'connect'}>
            {loading === 'connect' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            {t('connectButton')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Estado 2: conectado mas onboarding incompleto
  if (status.connected && !status.onboarding_complete) {
    return (
      <Card className="border-yellow-300 dark:border-yellow-700">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <CardTitle>{t('pendingTitle')}</CardTitle>
          </div>
          <CardDescription>{t('pendingDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleRefreshOnboarding}
            disabled={loading === 'refresh'}
            variant="outline"
            className="border-yellow-400 text-yellow-700 hover:bg-yellow-50 dark:text-yellow-400 dark:hover:bg-yellow-950/20"
          >
            {loading === 'refresh' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {t('completeVerification')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Estado 3: conectado e funcional
  return (
    <Card className="border-green-300 dark:border-green-700">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <CardTitle>{t('connectedTitle')}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {status.charges_enabled && (
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {t('statusPaymentsActive')}
            </Badge>
          )}
          {status.payouts_enabled && (
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              {t('statusPayoutsActive')}
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDashboard}
            disabled={loading === 'dashboard'}
          >
            {loading === 'dashboard' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4 mr-2" />
            )}
            {t('dashboardButton')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleConnect}
            disabled={loading === 'connect'}
          >
            {loading === 'connect' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            {t('reconnectButton')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
