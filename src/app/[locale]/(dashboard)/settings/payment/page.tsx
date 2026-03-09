import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { PaymentSettings } from '@/components/dashboard/payment-settings';
import { SimplifiedPaymentSetup } from '@/components/settings/SimplifiedPaymentSetup';
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
    .select('id, payment_method, manual_payment_key, payment_country, require_deposit, deposit_type, deposit_value, currency')
    .eq('user_id', user.id)
    .single();

  if (!professional) redirect('/register');

  // Check if Stripe Connect account is fully onboarded
  const { data: connectAccount } = await supabase
    .from('stripe_connect_accounts')
    .select('charges_enabled')
    .eq('professional_id', professional.id)
    .maybeSingle();

  const stripeConnected = connectAccount?.charges_enabled === true;

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

      <SimplifiedPaymentSetup
        currentMethod={(professional.payment_method as string) ?? null}
        currentKey={(professional.manual_payment_key as string) ?? null}
        currentCountry={(professional.payment_country as string) ?? null}
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
