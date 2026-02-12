import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createAdminClient();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const professionalId = session.metadata?.professional_id;
      if (professionalId) {
        await supabase
          .from('professionals')
          .update({
            subscription_status: 'active',
            stripe_customer_id: session.customer as string,
          })
          .eq('id', professionalId);
      }
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const status = subscription.status;

      let subStatus: string;
      if (status === 'active' || status === 'trialing') {
        subStatus = 'active';
      } else if (status === 'canceled' || status === 'unpaid') {
        subStatus = 'cancelled';
      } else {
        subStatus = 'expired';
      }

      await supabase
        .from('professionals')
        .update({ subscription_status: subStatus })
        .eq('stripe_customer_id', customerId);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      await supabase
        .from('professionals')
        .update({ subscription_status: 'cancelled' })
        .eq('stripe_customer_id', customerId);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      await supabase
        .from('professionals')
        .update({ subscription_status: 'expired' })
        .eq('stripe_customer_id', customerId);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
