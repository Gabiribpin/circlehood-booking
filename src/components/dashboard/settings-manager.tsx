'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, CreditCard, ExternalLink, AlertTriangle, Save, Check, Banknote, ChevronRight, Globe, Trash2, Download } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from '@/navigation';
import type { Professional } from '@/types/database';
import type { PlanPrice } from '@/lib/pricing';

const LOCALE_OPTIONS = [
  { value: 'pt-BR', label: '🇧🇷 Português (Brasil)' },
  { value: 'en-US', label: '🇺🇸 English (US)' },
  { value: 'es-ES', label: '🇪🇸 Español' },
];

type SettingsProfessional = Pick<Professional, 'business_name' | 'slug' | 'subscription_status' | 'trial_ends_at' | 'stripe_customer_id'> & {
  locale?: string | null;
  account_number?: string | null;
  created_at: string;
};

interface SettingsManagerProps {
  professional: SettingsProfessional;
  trialDaysLeft: number;
  trialExpired: boolean;
  success?: boolean;
  cancelled?: boolean;
  planPrice: PlanPrice;
  host: string;
}

export function SettingsManager({
  professional,
  trialDaysLeft,
  trialExpired,
  success,
  cancelled,
  planPrice,
  host,
}: SettingsManagerProps) {
  const t = useTranslations('settings');
  const tAccount = useTranslations('account');
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

  // Export data
  const [exporting, setExporting] = useState(false);

  // Account deletion
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0); // 0=hidden, 1=summary, 2=confirm
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const CONFIRM_WORD: Record<string, string> = {
    'pt-BR': 'EXCLUIR',
    'en-US': 'DELETE',
    'es-ES': 'ELIMINAR',
  };
  const confirmWord = CONFIRM_WORD[locale] ?? 'EXCLUIR';

  async function handleExportData() {
    setExporting(true);
    try {
      const res = await fetch('/api/account/export-data');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `circlehood-data-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail — user will notice the missing download
    } finally {
      setExporting(false);
    }
  }

  async function handleDeleteAccount() {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: deleteConfirmText, locale }),
      });
      if (!res.ok) {
        const data = await res.json();
        setDeleteError(data.error ?? tAccount('deleteError'));
        return;
      }
      // Account deleted — redirect to home
      window.location.href = '/';
    } catch {
      setDeleteError(tAccount('deleteError'));
    } finally {
      setDeleteLoading(false);
    }
  }

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
                  {planPrice.symbol}{planPrice.amount}<span className="text-sm font-normal text-muted-foreground">/mês</span>
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
                {host}/
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
            <Select value={selectedLocale} onValueChange={setSelectedLocale}>
              <SelectTrigger id="locale">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('languageHint')}
            </p>
          </div>

          {professional.account_number && (
            <div className="flex items-center justify-between py-1">
              <span className="text-sm text-muted-foreground">{t('accountNumber')}</span>
              <code className="text-xs bg-muted px-2 py-1 rounded tracking-wider">
                {professional.account_number}
              </code>
            </div>
          )}

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

      {/* Export Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Download className="h-4 w-4" />
            {tAccount('exportTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{tAccount('exportDesc')}</p>
          <Button
            variant="outline"
            onClick={handleExportData}
            disabled={exporting}
            className="gap-2"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {exporting ? tAccount('exporting') : tAccount('exportBtn')}
          </Button>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-red-700">
            <Trash2 className="h-4 w-4" />
            {tAccount('dangerZone')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {deleteStep === 0 && (
            <>
              <p className="text-sm text-red-700">{tAccount('deleteWarning')}</p>
              <Button
                variant="destructive"
                onClick={() => setDeleteStep(1)}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                {tAccount('deleteBtn')}
              </Button>
            </>
          )}

          {deleteStep === 1 && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-red-700">{tAccount('confirmTitle')}</p>
              <p className="text-sm text-muted-foreground">{tAccount('confirmText')}</p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={() => setDeleteStep(2)}
                >
                  {tAccount('confirmContinue')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDeleteStep(0)}
                >
                  {tAccount('cancelDeletion')}
                </Button>
              </div>
            </div>
          )}

          {deleteStep === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-red-700">
                {tAccount('confirmInputLabel')} <strong>{confirmWord}</strong>:
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={confirmWord}
                className="w-full border border-red-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
              {deleteError && (
                <p className="text-sm text-red-600">{deleteError}</p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading || deleteConfirmText.trim().toUpperCase() !== confirmWord}
                  className="gap-2"
                >
                  {deleteLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {tAccount('confirmBtn')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setDeleteStep(0); setDeleteConfirmText(''); setDeleteError(null); }}
                >
                  {tAccount('cancelDeletion')}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
