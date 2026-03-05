import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripeServer } from '@/lib/stripe/server';

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

  const loginLink = await stripe.accounts.createLoginLink(
    professional.stripe_account_id as string
  );

  return NextResponse.json({ url: loginLink.url });
  } catch (err) {
    logger.error('[stripe/connect/dashboard-link]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
