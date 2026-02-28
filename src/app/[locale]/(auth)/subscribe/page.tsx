'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CircleHoodLogoFull } from '@/components/branding/logo';
import { CreditCard, Check, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';

export default function SubscribePage() {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const cancelled = searchParams.get('cancelled') === 'true';
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Erro ao iniciar checkout.');
        setLoading(false);
      }
    } catch {
      setError('Erro de conexao. Tente novamente.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <CircleHoodLogoFull />
        </div>

        <Card className="border-2">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto p-3 rounded-full bg-primary/10 w-fit mb-3">
              <CreditCard className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-xl">{t('subscribeTitle')}</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              {t('subscribeDesc')}
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Plan details */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">CircleHood Booking Pro</span>
                <span className="text-lg font-bold">25,00/mth</span>
              </div>
              <div className="space-y-2">
                {[
                  t('subscribeTrial'),
                  t('subscribeFeature1'),
                  t('subscribeFeature2'),
                  t('subscribeFeature3'),
                ].map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    {feature}
                  </div>
                ))}
              </div>
            </div>

            {/* Security note */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-green-600" />
              <span>{t('subscribeSecure')}</span>
            </div>

            {cancelled && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  {t('subscribeCancelled')}
                </p>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <Button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full gap-2"
              size="lg"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4" />
              )}
              {t('subscribeButton')}
            </Button>

            <p className="text-[11px] text-muted-foreground text-center">
              {t('subscribeNote')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
