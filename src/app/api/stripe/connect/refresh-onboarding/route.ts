import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripeServer } from '@/lib/stripe/server';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://booking.circlehood-tech.com';

export async function POST(_request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: professional } = await supabase
    .from('professionals')
    .select('stripe_account_id')
    .eq('user_id', user.id)
    .single();

  if (!professional?.stripe_account_id) {
    return NextResponse.json({ error: 'Stripe account not found' }, { status: 404 });
  }

  const stripe = getStripeServer();
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const accountLink = await stripe.accountLinks.create({
    account: professional.stripe_account_id as string,
    refresh_url: `${BASE_URL}/settings/payment?connect=refresh`,
    return_url: `${BASE_URL}/settings/payment?connect=success`,
    type: 'account_onboarding',
  });

  return NextResponse.json({ url: accountLink.url });
}
