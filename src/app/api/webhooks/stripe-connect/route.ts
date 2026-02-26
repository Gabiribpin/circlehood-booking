import { NextRequest, NextResponse } from 'next/server';
import { getStripeServer } from '@/lib/stripe/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  const stripe = getStripeServer();
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createAdminClient();

  switch (event.type) {
    case 'account.updated': {
      const account = event.data.object as Stripe.Account;

      await supabase
        .from('stripe_connect_accounts')
        .update({
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          onboarding_complete: account.details_submitted,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_account_id', account.id);

      await supabase
        .from('professionals')
        .update({
          stripe_onboarding_completed: account.details_submitted,
        })
        .eq('stripe_account_id', account.id);

      break;
    }
  }

  return NextResponse.json({ received: true });
}
