import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe';

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: professional } = await supabase
    .from('professionals')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single();

  if (!professional?.stripe_customer_id) {
    return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
  }

  const stripe = getStripe();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  const session = await stripe.billingPortal.sessions.create({
    customer: professional.stripe_customer_id,
    return_url: `${baseUrl}/settings`,
  });

  return NextResponse.json({ url: session.url });
}
