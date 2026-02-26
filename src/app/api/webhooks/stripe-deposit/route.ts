import { NextRequest, NextResponse } from 'next/server';
import { getStripeServer } from '@/lib/stripe/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type Stripe from 'stripe';
import { sendBookingConfirmationEmail } from '@/lib/resend';
import { sendEvolutionMessage } from '@/lib/whatsapp/evolution';
import { safeSendEmail } from '@/lib/email/safe-send';
import { safeSendWhatsApp } from '@/lib/whatsapp/safe-send';

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

  const webhookSecret = process.env.STRIPE_DEPOSIT_WEBHOOK_SECRET;
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
    case 'payment_intent.succeeded': {
      const pi = event.data.object as Stripe.PaymentIntent;
      await supabase
        .from('payments')
        .update({
          status: 'succeeded',
          stripe_charge_id: pi.latest_charge as string | null,
          payment_method: pi.payment_method as string | null,
        })
        .eq('stripe_payment_intent_id', pi.id);
      break;
    }

    case 'payment_intent.payment_failed': {
      const pi = event.data.object as Stripe.PaymentIntent;
      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('stripe_payment_intent_id', pi.id);
      break;
    }

    case 'payment_intent.processing': {
      const pi = event.data.object as Stripe.PaymentIntent;
      await supabase
        .from('payments')
        .update({ status: 'processing' })
        .eq('stripe_payment_intent_id', pi.id);
      break;
    }

    case 'charge.refunded': {
      const charge = event.data.object as Stripe.Charge;
      if (charge.payment_intent) {
        await supabase
          .from('payments')
          .update({ status: 'refunded' })
          .eq('stripe_payment_intent_id', charge.payment_intent as string);
      }
      break;
    }

    // Subscription invoice events — track payment_failed_at for grace-period logic
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string | null;
      if (customerId) {
        await supabase
          .from('professionals')
          .update({ payment_failed_at: new Date().toISOString() })
          .eq('stripe_customer_id', customerId);
      }
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string | null;
      if (customerId) {
        await supabase
          .from('professionals')
          .update({ payment_failed_at: null })
          .eq('stripe_customer_id', customerId);
      }
      break;
    }

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.type !== 'deposit') break;

      const bookingId = session.metadata.booking_id;
      if (!bookingId) break;

      // Confirmar booking
      await supabase
        .from('bookings')
        .update({ status: 'confirmed' })
        .eq('id', bookingId)
        .eq('status', 'pending_payment');

      // Atualizar payment
      await supabase
        .from('payments')
        .update({
          status: 'succeeded',
          stripe_payment_intent_id: session.payment_intent as string | null,
        })
        .eq('stripe_checkout_session_id', session.id);

      // Disparar notificações (fire-and-forget)
      void (async () => {
        try {
          const { data: booking } = await supabase
            .from('bookings')
            .select('*, services(name, price, duration_minutes)')
            .eq('id', bookingId)
            .single();

          if (!booking) return;

          const { data: professional } = await supabase
            .from('professionals')
            .select('user_id, business_name, currency')
            .eq('id', booking.professional_id)
            .single();

          if (!professional) return;

          const service = booking.services as { name: string; price: number } | null;
          const startTime = (booking.start_time as string).slice(0, 5);
          const endTime = (booking.end_time as string).slice(0, 5);

          // Email
          await safeSendEmail(async () => {
            const { data: userData } = await supabase.auth.admin.getUserById(professional.user_id);
            if (!userData?.user?.email) return;
            await sendBookingConfirmationEmail({
              clientName: booking.client_name,
              clientEmail: booking.client_email || undefined,
              professionalEmail: userData.user.email,
              businessName: professional.business_name,
              serviceName: service?.name ?? '',
              servicePrice: service?.price ?? 0,
              currency: professional.currency,
              bookingDate: booking.booking_date,
              startTime,
              endTime,
              bookingId: booking.id,
              professionalId: booking.professional_id,
            });
          }, { label: 'Email checkout confirmação' });

          // WhatsApp
          if (booking.client_phone) {
            const { data: config } = await supabase
              .from('whatsapp_config')
              .select('evolution_api_url, evolution_api_key, evolution_instance')
              .eq('user_id', professional.user_id)
              .eq('is_active', true)
              .maybeSingle();

            if (config?.evolution_api_url && config.evolution_api_key && config.evolution_instance) {
              const symbols: Record<string, string> = { EUR: '€', GBP: '£', USD: '$', BRL: 'R$' };
              const sym = symbols[professional.currency] || professional.currency;
              const formattedDate = (booking.booking_date as string).split('-').reverse().join('/');
              const formattedPrice = `${sym}${Number(service?.price ?? 0).toFixed(0)}`;

              const message =
                `Olá ${booking.client_name}! Seu agendamento foi confirmado 🎉\n` +
                `\n📅 ${formattedDate} às ${startTime}` +
                `\n✂️ ${service?.name} — ${formattedPrice}` +
                `\n\nNos vemos em breve! 😊`;

              await safeSendWhatsApp(
                async () => {
                  await sendEvolutionMessage(booking.client_phone!, message, {
                    apiUrl: config.evolution_api_url!,
                    apiKey: config.evolution_api_key!,
                    instance: config.evolution_instance!,
                  });
                },
                {}
              );
            }
          }
        } catch (err) {
          console.error('[Webhook] checkout.session.completed notifications failed:', err);
        }
      })();

      break;
    }
  }

  return NextResponse.json({ received: true });
}
