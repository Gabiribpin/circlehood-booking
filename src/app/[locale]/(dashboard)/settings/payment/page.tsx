import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { PaymentSettings } from '@/components/dashboard/payment-settings';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default async function PaymentSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: professional } = await supabase
    .from('professionals')
    .select(
      'currency, require_deposit, deposit_type, deposit_value, stripe_account_id, stripe_onboarding_completed'
    )
    .eq('user_id', user.id)
    .single();

  if (!professional) redirect('/register');

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Definições
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Pagamentos</h1>
        <p className="text-muted-foreground mt-1">
          Configure o sinal de reserva cobrado aos seus clientes.
        </p>
      </div>

      <PaymentSettings
        requireDeposit={professional.require_deposit ?? false}
        depositType={(professional.deposit_type as 'percentage' | 'fixed' | null) ?? null}
        depositValue={professional.deposit_value ?? null}
        currency={professional.currency ?? 'EUR'}
      />
    </div>
  );
}
