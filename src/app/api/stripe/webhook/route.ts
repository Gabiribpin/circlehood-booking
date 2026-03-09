import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';
import { isEventProcessed, markEventProcessed } from '@/lib/webhooks/event-dedup';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Reject events older than 5 minutes (replay attack protection)
  const EVENT_MAX_AGE_SECONDS = 300;
  const eventAge = Math.floor(Date.now() / 1000) - event.created;
  if (eventAge > EVENT_MAX_AGE_SECONDS) {
    logger.warn('[stripe/webhook] rejected stale event', { id: event.id, age: eventAge });
    return NextResponse.json({ error: 'Event too old' }, { status: 400 });
  }

  // Dedup: skip if event already processed (Stripe retries)
  if (await isEventProcessed(event.id)) {
    return NextResponse.json({ received: true, deduplicated: true });
  }

  const supabase = createAdminClient();

  try {
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
  } catch (processingError: any) {
    logger.error('[stripe/webhook] Error processing event:', processingError);
    await supabase.from('cron_logs').insert({
      job_name: 'webhook_stripe',
      status: 'error',
      error_message: processingError.message || 'Unknown error',
      metadata: {
        event_type: event.type,
        event_id: event.id,
      },
    } as never);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }

  await markEventProcessed(event.id);
  return NextResponse.json({ received: true });
}
