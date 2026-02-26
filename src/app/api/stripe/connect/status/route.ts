import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: professional } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!professional) {
    return NextResponse.json({ error: 'Professional not found' }, { status: 404 });
  }

  const { data: connectAccount } = await supabase
    .from('stripe_connect_accounts')
    .select('stripe_account_id, charges_enabled, payouts_enabled, onboarding_complete')
    .eq('professional_id', professional.id)
    .maybeSingle();

  if (!connectAccount) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    stripe_account_id: connectAccount.stripe_account_id,
    charges_enabled: connectAccount.charges_enabled,
    payouts_enabled: connectAccount.payouts_enabled,
    onboarding_complete: connectAccount.onboarding_complete,
  });
}
