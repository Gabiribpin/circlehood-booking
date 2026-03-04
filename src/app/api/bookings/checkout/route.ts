import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripeServer } from '@/lib/stripe/server';
import { calculateDeposit, toCents } from '@/lib/payment/calculate-deposit';
import { bookingSchema, sanitizeString } from '@/lib/validation/booking-schema';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://booking.circlehood-tech.com';

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
      { error: firstIssue?.message ?? 'Dados inválidos.', issues: parsed.error.issues },
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
      'subscription_status, trial_ends_at, stripe_account_id, currency, require_deposit, deposit_type, deposit_value'
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

  if (!prof.require_deposit || !prof.deposit_type || prof.deposit_value == null) {
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

  // ─── 8. Check double-booking ─────────────────────────────────────────────
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

  // ─── 9. Insert booking com status pending_payment ────────────────────────
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
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }

  // ─── 10. Calcular sinal + taxa plataforma ────────────────────────────────
  const depositAmount = calculateDeposit(
    service.price,
    prof.deposit_type as 'percentage' | 'fixed',
    prof.deposit_value as number
  );
  const depositCents = toCents(depositAmount);
  const applicationFeeCents = Math.round(depositCents * 0.05);

  // ─── 11. Criar Stripe Checkout Session ───────────────────────────────────
  const stripe = getStripeServer();
  if (!stripe) {
    // Rollback: cancelar booking criado
    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', booking.id);
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const currencyCode = (prof.currency as string)?.toLowerCase() || 'eur';

  // Idempotency key baseada no booking.id: retry-safe (mesmo booking = mesma session)
  const idempotencyKey = `cs:${booking.id}`;

  const session = await stripe.checkout.sessions.create(
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
      success_url: `${BASE_URL}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${BASE_URL}/booking/cancel`,
    },
    { idempotencyKey }
  );

  // ─── 12. INSERT payment ──────────────────────────────────────────────────
  await supabase.from('payments').insert({
    professional_id,
    booking_id: booking.id,
    amount: depositAmount,
    currency: currencyCode,
    status: 'pending',
    stripe_checkout_session_id: session.id,
  });

  return NextResponse.json({ session_url: session.url });
}
