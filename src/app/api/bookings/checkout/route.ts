import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripeServer } from '@/lib/stripe/server';
import { calculateDeposit, toCents } from '@/lib/payment/calculate-deposit';
import { bookingSchema, sanitizeString } from '@/lib/validation/booking-schema';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://booking.circlehood-tech.com';
const APPLICATION_FEE_PERCENT = parseFloat(process.env.STRIPE_APPLICATION_FEE_PERCENT ?? '5') / 100;

export async function POST(request: NextRequest) {
  // ─── 1. Parse + validação Zod ────────────────────────────────────────
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload JSON inválido.' }, { status: 400 });
  }

  const parsed = bookingSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      { error: firstIssue?.message ?? 'Dados inválidos.' },
      { status: 400 }
    );
  }

  // ─── 2. Sanitização ────────────────────────────────────────────────────
  const {
    professional_id,
    service_id,
    booking_date,
    start_time: rawStartTime,
    service_location,
    customer_address,
    customer_address_city,
  } = parsed.data;

  const client_name = sanitizeString(parsed.data.client_name);
  const client_email = parsed.data.client_email
    ? sanitizeString(parsed.data.client_email)
    : undefined;
  const client_phone = parsed.data.client_phone;
  const notes = parsed.data.notes ? sanitizeString(parsed.data.notes) : undefined;

  const start_time = rawStartTime.slice(0, 5);

  if (client_name.length < 2) {
    return NextResponse.json({ error: 'Nome inválido.' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // ─── 3. Check trial expiration ─────────────────────────────────────────
  const { data: prof } = await supabase
    .from('professionals')
    .select(
      'subscription_status, trial_ends_at, stripe_account_id, currency, require_deposit, deposit_type, deposit_value, slug'
    )
    .eq('id', professional_id)
    .single();

  if (!prof) {
    return NextResponse.json({ error: 'Profissional não encontrado.' }, { status: 404 });
  }

  const trialExpired =
    prof.subscription_status === 'trial' &&
    new Date(prof.trial_ends_at) < new Date();
  const inactive =
    prof.subscription_status === 'cancelled' ||
    prof.subscription_status === 'expired';

  if (trialExpired || inactive) {
    return NextResponse.json(
      { error: 'Agendamento indisponível. O profissional precisa ativar o plano.' },
      { status: 403 }
    );
  }

  // ─── 4. Verificar Connect ───────────────────────────────────────────────
  if (
    !prof.stripe_account_id ||
    typeof prof.stripe_account_id !== 'string' ||
    !prof.stripe_account_id.startsWith('acct_')
  ) {
    return NextResponse.json(
      { error: 'Profissional não configurou conta Stripe.' },
      { status: 422 }
    );
  }

  // ─── 4b. Verificar charges_enabled / payouts_enabled ──────────────────
  const stripeCheck = getStripeServer();
  if (stripeCheck) {
    try {
      const account = await stripeCheck.accounts.retrieve(prof.stripe_account_id);
      if (!account.charges_enabled || !account.payouts_enabled) {
        return NextResponse.json(
          { error: 'Conta Stripe do profissional com onboarding incompleto.' },
          { status: 422 }
        );
      }
    } catch (err) {
      logger.error('[bookings/checkout] Stripe account check failed', err);
      return NextResponse.json(
        { error: 'Não foi possível verificar a conta Stripe do profissional.' },
        { status: 502 }
      );
    }
  }

  if (!prof.require_deposit || !prof.deposit_type || prof.deposit_value == null || prof.deposit_value <= 0) {
    return NextResponse.json(
      { error: 'Sinal não configurado.' },
      { status: 422 }
    );
  }

  // ─── 5. Get service ─────────────────────────────────────────────────────
  const { data: service } = await supabase
    .from('services')
    .select('duration_minutes, name, price')
    .eq('id', service_id)
    .eq('professional_id', professional_id)
    .single();

  if (!service) {
    return NextResponse.json({ error: 'Service not found' }, { status: 404 });
  }

  // ─── 6. Validar data ────────────────────────────────────────────────────
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  yesterday.setUTCHours(0, 0, 0, 0);
  const bookingDateObj = new Date(booking_date + 'T00:00:00Z');
  if (bookingDateObj < yesterday) {
    return NextResponse.json(
      { error: 'Não é possível agendar em datas passadas.' },
      { status: 400 }
    );
  }

  // ─── 7. Calculate end_time ──────────────────────────────────────────────
  const [h, m] = start_time.split(':').map(Number);
  const totalMinutes = h * 60 + m + service.duration_minutes;
  const endH = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const endM = (totalMinutes % 60).toString().padStart(2, '0');
  const end_time = `${endH}:${endM}`;

  // ─── 8. Pre-validate Stripe + deposit BEFORE booking insert ─────────────
  const stripe = getStripeServer();
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const depositAmount = calculateDeposit(
    service.price,
    prof.deposit_type as 'percentage' | 'fixed',
    prof.deposit_value as number
  );
  const depositCents = toCents(depositAmount);
  if (depositCents <= 0) {
    return NextResponse.json({ error: 'Valor do sinal inválido.' }, { status: 400 });
  }
  const applicationFeeCents = Math.round(depositCents * APPLICATION_FEE_PERCENT);

  // ─── 9a. Expire stale pending_payment bookings (>30min) before conflict check ─
  const paymentCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  await supabase
    .from('bookings')
    .update({ status: 'expired' })
    .eq('professional_id', professional_id)
    .eq('booking_date', booking_date)
    .eq('status', 'pending_payment')
    .lt('created_at', paymentCutoff);

  // ─── 9b. Check double-booking ─────────────────────────────────────────────
  const { data: conflicts } = await supabase
    .from('bookings')
    .select('id')
    .eq('professional_id', professional_id)
    .eq('booking_date', booking_date)
    .in('status', ['confirmed', 'pending_payment'])
    .lt('start_time', `${end_time}:00`)
    .gt('end_time', `${start_time}:00`);

  if (conflicts && conflicts.length > 0) {
    return NextResponse.json(
      { error: 'Horario indisponível. Escolha outro horario.' },
      { status: 409 }
    );
  }

  // ─── 10. Insert booking com status pending_payment ────────────────────────
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      professional_id,
      service_id,
      booking_date,
      start_time: `${start_time}:00`,
      end_time: `${end_time}:00`,
      client_name,
      client_email: client_email || null,
      client_phone: client_phone || null,
      notes: notes || null,
      status: 'pending_payment',
      service_location: service_location || 'in_salon',
      customer_address: customer_address || null,
      customer_address_city: customer_address_city || null,
    })
    .select()
    .single();

  if (bookingError) {
    if (bookingError.code === '23505') {
      return NextResponse.json(
        { error: 'Horario indisponível. Escolha outro horario.' },
        { status: 409 }
      );
    }
    logger.error('[bookings/checkout] booking insert failed', bookingError);
    return NextResponse.json({ error: 'Erro ao criar agendamento. Tente novamente.' }, { status: 500 });
  }

  const currencyCode = (prof.currency as string)?.toLowerCase() || 'eur';

  // ─── 10b. INSERT payment record immediately after booking (minimize inconsistency window)
  const { error: paymentError } = await supabase.from('payments').insert({
    professional_id,
    booking_id: booking.id,
    amount: depositAmount,
    currency: currencyCode,
    status: 'pending',
    stripe_checkout_session_id: null,
  });

  if (paymentError) {
    logger.error('[bookings/checkout] payment insert failed — rolling back booking', paymentError);
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id);
    return NextResponse.json({ error: 'Erro ao registrar pagamento. Tente novamente.' }, { status: 500 });
  }

  // Idempotency key baseada no booking.id: retry-safe (mesmo booking = mesma session)
  const idempotencyKey = `cs:${booking.id}`;

  let session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: currencyCode,
              product_data: {
                name: `Sinal — ${service.name}`,
                description: `Agendamento ${booking_date} às ${start_time}`,
              },
              unit_amount: depositCents,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          application_fee_amount: applicationFeeCents,
          transfer_data: {
            destination: prof.stripe_account_id as string,
          },
        },
        metadata: {
          booking_id: booking.id,
          type: 'deposit',
        },
        customer_email: client_email,
        success_url: `${BASE_URL}/booking/success?session_id={CHECKOUT_SESSION_ID}&slug=${encodeURIComponent(prof.slug as string || '')}`,
        cancel_url: `${BASE_URL}/booking/cancel?slug=${encodeURIComponent(prof.slug as string || '')}`,
      },
      { idempotencyKey }
    );
  } catch (err) {
    logger.error('[bookings/checkout] Stripe session creation failed', err);
    // Rollback: cancelar booking + payment para liberar o slot
    await supabase.from('payments').delete().eq('booking_id', booking.id);
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id);
    return NextResponse.json({ error: 'Falha ao criar sessão de pagamento. Tente novamente.' }, { status: 502 });
  }

  // ─── 12. Update payment with Stripe session ID ─────────────────────────
  await supabase
    .from('payments')
    .update({ stripe_checkout_session_id: session.id })
    .eq('booking_id', booking.id);

  return NextResponse.json({ session_url: session.url });
}
