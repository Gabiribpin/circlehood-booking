import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { PaymentSettings } from '@/components/dashboard/payment-settings';
import { StripeConnectCard } from '@/components/dashboard/stripe-connect-card';
import type { ConnectStatus } from '@/components/dashboard/stripe-connect-card';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/navigation';

export default async function PaymentSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: professional } = await supabase
    .from('professionals')
    .select(
      'id, currency, require_deposit, deposit_type, deposit_value, stripe_account_id, stripe_onboarding_completed'
    )
    .eq('user_id', user.id)
    .single();

  if (!professional) redirect('/register');

  // Buscar status Connect
  const { data: connectAccount } = await supabase
    .from('stripe_connect_accounts')
    .select('stripe_account_id, charges_enabled, payouts_enabled, onboarding_complete')
    .eq('professional_id', professional.id)
    .maybeSingle();

  const connectStatus: ConnectStatus = connectAccount
    ? {
        connected: true,
        stripe_account_id: connectAccount.stripe_account_id,
        charges_enabled: connectAccount.charges_enabled ?? false,
        payouts_enabled: connectAccount.payouts_enabled ?? false,
        onboarding_complete: connectAccount.onboarding_complete ?? false,
      }
    : { connected: false };

  const stripeConnected =
    connectStatus.connected &&
    (connectStatus.charges_enabled ?? false);

  const t = await getTranslations('payment');

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToSettings')}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      <StripeConnectCard
        status={connectStatus}
        currency={professional.currency ?? 'EUR'}
      />

      <PaymentSettings
        requireDeposit={professional.require_deposit ?? false}
        depositType={(professional.deposit_type as 'percentage' | 'fixed' | null) ?? null}
        depositValue={professional.deposit_value ?? null}
        currency={professional.currency ?? 'EUR'}
        stripeConnected={stripeConnected}
      />
    </div>
  );
}
