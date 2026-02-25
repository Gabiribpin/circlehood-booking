'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CreditCard, ExternalLink, AlertTriangle, Save, Check, Banknote, ChevronRight, Globe } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from '@/navigation';
import type { Professional } from '@/types/database';

const LOCALE_OPTIONS = [
  { value: 'pt-BR', label: '🇧🇷 Português (Brasil)' },
  { value: 'en-US', label: '🇺🇸 English (US)' },
  { value: 'es-ES', label: '🇪🇸 Español' },
];

interface SettingsManagerProps {
  professional: Professional;
  trialDaysLeft: number;
  trialExpired: boolean;
  success?: boolean;
  cancelled?: boolean;
}

export function SettingsManager({
  professional,
  trialDaysLeft,
  trialExpired,
  success,
  cancelled,
}: SettingsManagerProps) {
  const t = useTranslations('settings');
  const locale = useLocale();
  const router = useRouter();
  const [loadingCheckout, setLoadingCheckout] = useState(false);
  const [loadingPortal, setLoadingPortal] = useState(false);

  // Editable account fields
  const [businessName, setBusinessName] = useState(professional.business_name);
  const [slug, setSlug] = useState(professional.slug);
  const [selectedLocale, setSelectedLocale] = useState(professional.locale ?? 'pt-BR');
  const [savingAccount, setSavingAccount] = useState(false);
  const [accountSaved, setAccountSaved] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  async function handleSaveAccount() {
    if (!businessName.trim()) {
      setAccountError(t('errorBusinessNameEmpty'));
      return;
    }
    if (!slug.trim()) {
      setAccountError(t('errorSlugEmpty'));
      return;
    }

    const validSlug = slug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    setSavingAccount(true);
    setAccountError(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t('errorNotAuthenticated'));

      // Check slug uniqueness
      const { data: existing } = await supabase
        .from('professionals')
        .select('id')
        .eq('slug', validSlug)
        .neq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        setAccountError(t('errorSlugTaken'));
        setSavingAccount(false);
        return;
      }

      const { error } = await supabase
        .from('professionals')
        .update({ business_name: businessName.trim(), slug: validSlug, locale: selectedLocale })
        .eq('user_id', user.id);

      if (error) throw error;

      setSlug(validSlug);
      setAccountSaved(true);
      // If locale changed, redirect to new locale path after brief confirmation
      setTimeout(() => {
        setAccountSaved(false);
        // Update NEXT_LOCALE cookie so the next-intl middleware uses the new locale
        // on hard reload (especially important for pt-BR where URL has no prefix)
        document.cookie = `NEXT_LOCALE=${selectedLocale}; path=/; max-age=31536000; SameSite=Lax`;
        router.replace('/settings', { locale: selectedLocale });
      }, 1500);
    } catch (err: any) {
      setAccountError(err?.message ?? t('errorSave'));
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleCheckout() {
    setLoadingCheckout(true);
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setLoadingCheckout(false);
    }
  }

  async function handlePortal() {
    setLoadingPortal(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setLoadingPortal(false);
    }
  }

  const isActive = professional.subscription_status === 'active';
  const isTrial = professional.subscription_status === 'trial';

  function getSubscriptionStatusLabel() {
    if (isActive) return t('statusProActive');
    if (isTrial && !trialExpired) return t('statusTrialActive', { days: trialDaysLeft });
    if (isTrial && trialExpired) return t('statusTrialExpired');
    if (professional.subscription_status === 'cancelled') return t('statusCancelled');
    return t('statusExpired');
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>

      {success && (
        <Card className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-green-600" />
            <p className="text-sm text-green-700 dark:text-green-400">
              {t('successActivated')}
            </p>
          </CardContent>
        </Card>
      )}

      {cancelled && (
        <Card className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              {t('checkoutCancelled')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Subscription Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('subscriptionTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('statusLabel')}</span>
            <Badge
              variant={
                isActive
                  ? 'default'
                  : isTrial && !trialExpired
                    ? 'secondary'
                    : 'destructive'
              }
            >
              {getSubscriptionStatusLabel()}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{t('planLabel')}</span>
            <span className="text-sm font-medium">
              {isActive ? t('planPro') : t('planFree')}
            </span>
          </div>

          {isTrial && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('trialEndsAt')}</span>
              <span className="text-sm">
                {new Date(professional.trial_ends_at).toLocaleDateString(locale)}
              </span>
            </div>
          )}

          {professional.stripe_customer_id && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{t('stripeId')}</span>
              <span className="text-xs font-mono text-muted-foreground">
                {professional.stripe_customer_id.slice(0, 18)}...
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trial Expired Warning */}
      {trialExpired && !isActive && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <p className="text-sm font-medium text-destructive">
                {t('trialExpiredTitle')}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('trialExpiredDesc')}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <Card>
        <CardContent className="p-6 space-y-3">
          {!isActive ? (
            <>
              <div className="text-center mb-4">
                <p className="text-2xl font-bold">
                  &euro;25<span className="text-sm font-normal text-muted-foreground">/mês</span>
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('priceDesc')}
                </p>
              </div>
              <Button
                onClick={handleCheckout}
                disabled={loadingCheckout}
                className="w-full gap-2"
                size="lg"
              >
                {loadingCheckout ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="h-4 w-4" />
                )}
                {t('subscribePro')}
              </Button>
            </>
          ) : (
            <Button
              onClick={handlePortal}
              disabled={loadingPortal}
              variant="outline"
              className="w-full gap-2"
            >
              {loadingPortal ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              {t('manageSubscription')}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Pagamentos do cliente (sinal/depósito) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('paymentsTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Link
            href="/settings/payment"
            className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Banknote className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{t('setupDeposit')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('setupDepositDesc')}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

      {/* Account Info — Editable */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('accountTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="businessName">{t('businessNameLabel')}</Label>
            <Input
              id="businessName"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder={t('businessNamePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">{t('pageUrlLabel')}</Label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {typeof window !== 'undefined' ? window.location.host : 'circlehood-booking.vercel.app'}/
              </span>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder={t('pageUrlPlaceholder')}
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t('pageUrlHint')}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="locale" className="flex items-center gap-2">
              <Globe className="h-4 w-4" /> {t('languageLabel')}
            </Label>
            <select
              id="locale"
              value={selectedLocale}
              onChange={(e) => setSelectedLocale(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {LOCALE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {t('languageHint')}
            </p>
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-muted-foreground">{t('memberSince')}</span>
            <span className="text-sm">
              {new Date(professional.created_at).toLocaleDateString(locale)}
            </span>
          </div>

          {accountError && (
            <p className="text-sm text-destructive">{accountError}</p>
          )}

          <Button
            onClick={handleSaveAccount}
            disabled={savingAccount}
            className="w-full gap-2"
          >
            {savingAccount ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : accountSaved ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {accountSaved ? t('saved') : t('saveChanges')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
