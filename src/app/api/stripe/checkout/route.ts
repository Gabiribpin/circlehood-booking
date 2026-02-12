import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getStripe, PRICE_ID } from '@/lib/stripe';

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
    .select('id, stripe_customer_id, business_name')
    .eq('user_id', user.id)
    .single();

  if (!professional) {
    return NextResponse.json({ error: 'Professional not found' }, { status: 404 });
  }

  const stripe = getStripe();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  // Create or reuse Stripe customer
  let customerId = professional.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: professional.business_name,
      metadata: { professional_id: professional.id },
    });
    customerId = customer.id;

    await supabase
      .from('professionals')
      .update({ stripe_customer_id: customerId })
      .eq('id', professional.id);
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: PRICE_ID, quantity: 1 }],
    success_url: `${baseUrl}/settings?success=true`,
    cancel_url: `${baseUrl}/settings?cancelled=true`,
    metadata: { professional_id: professional.id },
  });

  return NextResponse.json({ url: session.url });
}
