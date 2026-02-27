import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripeServer } from '@/lib/stripe/server';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://booking.circlehood-tech.com';

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: professional } = await supabase
      .from('professionals')
      .select('id, country, address_country, currency, stripe_account_id')
      .eq('user_id', user.id)
      .single();

    if (!professional) {
      return NextResponse.json({ error: 'Professional not found' }, { status: 404 });
    }

    const stripe = getStripeServer();
    if (!stripe) {
      console.error('[stripe/connect/create-account] STRIPE_SECRET_KEY not set');
      return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
    }

    const admin = createAdminClient();

    // Se já tem stripe_account_id → apenas gerar novo AccountLink (refresh)
    let stripeAccountId = professional.stripe_account_id as string | null;

    if (!stripeAccountId) {
      // Verificar se já tem conta na tabela connect (edge case)
      const { data: existing } = await admin
        .from('stripe_connect_accounts')
        .select('stripe_account_id')
        .eq('professional_id', professional.id)
        .maybeSingle();

      if (existing) {
        stripeAccountId = existing.stripe_account_id;
      }
    }

    if (!stripeAccountId) {
      // Criar nova conta Standard
      const email = user.email;
      const country = (professional.address_country as string) || (professional.country as string) || 'IE';

      console.log('[stripe/connect/create-account] creating Standard account', {
        country,
        hasEmail: !!email,
      });

      const account = await stripe.accounts.create({
        type: 'standard',
        country,
        email: email ?? undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          professional_id: professional.id,
        },
      });

      stripeAccountId = account.id;
      console.log('[stripe/connect/create-account] account created:', stripeAccountId);

      // INSERT na tabela connect
      await admin.from('stripe_connect_accounts').upsert({
        professional_id: professional.id,
        stripe_account_id: stripeAccountId,
        country,
        currency: (professional.currency as string)?.toLowerCase() || 'eur',
      });

      // UPDATE professionals.stripe_account_id
      await admin
        .from('professionals')
        .update({ stripe_account_id: stripeAccountId })
        .eq('id', professional.id);
    }

    // Criar AccountLink
    console.log('[stripe/connect/create-account] creating AccountLink for', stripeAccountId);
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${BASE_URL}/settings/payment?connect=refresh`,
      return_url: `${BASE_URL}/settings/payment?connect=success`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[stripe/connect/create-account] error:', message);
    return NextResponse.json(
      { error: 'Failed to create Stripe Connect account', detail: message },
      { status: 500 }
    );
  }
}
