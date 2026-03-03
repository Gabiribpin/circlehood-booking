import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendBookingConfirmationEmail } from '@/lib/resend';
import { sendEvolutionMessage } from '@/lib/whatsapp/evolution';
import { safeSendEmail } from '@/lib/email/safe-send';
import { safeSendWhatsApp } from '@/lib/whatsapp/safe-send';
import { bookingSchema, sanitizeString } from '@/lib/validation/booking-schema';

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

  // ─── 2. Sanitização de inputs de texto (XSS) ─────────────────────────
  const {
    professional_id,
    service_id,
    booking_date,
    start_time: rawStartTime,
    service_location,
    customer_address,
    customer_address_city,
    payment_intent_id,
  } = parsed.data;

  const client_name = sanitizeString(parsed.data.client_name);
  const client_email = parsed.data.client_email
    ? sanitizeString(parsed.data.client_email)
    : undefined;
  const client_phone = parsed.data.client_phone;
  const notes = parsed.data.notes ? sanitizeString(parsed.data.notes) : undefined;

  // Normalizar start_time para HH:MM (sem segundos)
  const start_time = rawStartTime.slice(0, 5);

  // ─── 3. Validar que nome não ficou vazio após sanitização ─────────────
  if (client_name.length < 2) {
    return NextResponse.json({ error: 'Nome inválido.' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // ─── 4. Check trial expiration ────────────────────────────────────────
  const { data: prof } = await supabase
    .from('professionals')
    .select('subscription_status, trial_ends_at')
    .eq('id', professional_id)
    .single();

  if (prof) {
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
  }

  // ─── 5. Get service — valida que pertence ao profissional ─────────────
  const { data: service } = await supabase
    .from('services')
    .select('duration_minutes, name, price')
    .eq('id', service_id)
    .eq('professional_id', professional_id)
    .single();

  if (!service) {
    return NextResponse.json({ error: 'Service not found' }, { status: 404 });
  }

  // ─── 6. Validar data não é passado (leniente: permite hoje em qualquer fuso) ──
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

  // ─── 7. Calculate end_time ────────────────────────────────────────────
  const [h, m] = start_time.split(':').map(Number);
  const totalMinutes = h * 60 + m + service.duration_minutes;
  const endH = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const endM = (totalMinutes % 60).toString().padStart(2, '0');
  const end_time = `${endH}:${endM}`;

  // ─── 8. Idempotência — janela de 5 minutos ────────────────────────────
  // Previne duplicatas por back-button / duplo-tab / retry de rede
  // IMPORTANTE: deve vir ANTES do double-booking check para que
  // retransmissões do mesmo agendamento retornem 200 (não 409).
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: recentBooking } = await supabase
    .from('bookings')
    .select('*')
    .eq('professional_id', professional_id)
    .eq('service_id', service_id)
    .eq('booking_date', booking_date)
    .eq('start_time', `${start_time}:00`)
    .eq('client_phone', client_phone)
    .neq('status', 'cancelled')
    .gte('created_at', fiveMinutesAgo)
    .maybeSingle();

  if (recentBooking) {
    return NextResponse.json(
      { booking: recentBooking, message: 'Agendamento já registrado.' },
      { status: 200 }
    );
  }

  // ─── 9a. Expirar pending_payment antigos (>30min) antes do conflict check ──
  // Libera slots abandonados em tempo real, sem depender de cron.
  const paymentCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  await supabase
    .from('bookings')
    .update({ status: 'expired' })
    .eq('professional_id', professional_id)
    .eq('booking_date', booking_date)
    .eq('status', 'pending_payment')
    .lt('created_at', paymentCutoff);

  // ─── 9b. Check double-booking ──────────────────────────────────────────
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

  // ─── 10. Insert booking ───────────────────────────────────────────────
  const { data: booking, error } = await supabase
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
      status: 'confirmed',
      service_location: service_location || 'in_salon',
      customer_address: customer_address || null,
      customer_address_city: customer_address_city || null,
    })
    .select()
    .single();

  if (error) {
    // 23505 = unique_violation: slot ocupado por race condition
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'Horario indisponível. Escolha outro horario.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }

  // ─── 11. Ligar payment_intent_id ao booking (fire-and-forget) ───────────
  if (payment_intent_id) {
    void (async () => {
      try {
        await supabase
          .from('payments')
          .update({ booking_id: booking.id })
          .eq('stripe_payment_intent_id', payment_intent_id);
      } catch (err) {
        logger.error('[Booking] Payment link failed:', err);
      }
    })();
  }

  // ─── 12. Auto-save contato (fire-and-forget) ──────────────────────────
  ;(async () => {
    try {
      const phone = (client_phone ?? '').replace(/\D/g, '') || client_phone;
      if (!phone || !professional_id) return;
      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .eq('professional_id', professional_id)
        .eq('phone', phone)
        .maybeSingle();
      if (!existing) {
        await supabase.from('contacts').insert({
          professional_id,
          name: client_name,
          phone,
          email: client_email || null,
        });
      }
    } catch (err) {
      logger.error('[Booking] Contact auto-save failed:', err);
    }
  })();

  // ─── 13. Get professional info para notificações ──────────────────────
  const { data: professional } = await supabase
    .from('professionals')
    .select('user_id, business_name, currency')
    .eq('id', professional_id)
    .single();

  if (professional) {
    // ─── 14. Email de confirmação (fire-and-forget resiliente) ────────
    ;(async () => {
      await safeSendEmail(
        async () => {
          const { data: userData } = await supabase.auth.admin.getUserById(
            professional.user_id
          );
          if (!userData?.user?.email) return;
          await sendBookingConfirmationEmail({
            clientName: client_name,
            clientEmail: client_email || undefined,
            professionalEmail: userData.user.email,
            businessName: professional.business_name,
            serviceName: service.name,
            servicePrice: service.price,
            currency: professional.currency,
            bookingDate: booking_date,
            startTime: start_time,
            endTime: end_time,
            bookingId: booking.id,
            professionalId: professional_id,
          });
        },
        {
          label: 'Email confirmação',
          onFailure: (error) => {
            // Registrar falha em notification_logs (fire-and-forget)
            void (async () => {
              try {
                await supabase.from('notification_logs').insert({
                  professional_id,
                  booking_id: booking.id,
                  type: 'booking_confirmation',
                  channel: 'email',
                  recipient: client_email ?? 'professional',
                  message: `Novo agendamento: ${client_name}`,
                  status: 'failed',
                  error_message: error,
                });
              } catch { /* nunca quebrar o fluxo */ }
            })();
          },
        }
      );
    })();

    // ─── 15. WhatsApp de confirmação (fire-and-forget resiliente) ─────
    if (client_phone) {
      ;(async () => {
        const { data: config } = await supabase
          .from('whatsapp_config')
          .select(
            'provider, phone_number_id, access_token, evolution_api_url, evolution_api_key, evolution_instance'
          )
          .eq('user_id', professional.user_id)
          .eq('is_active', true)
          .maybeSingle();

        if (!config) return;

        const formattedDate = booking_date.split('-').reverse().join('/');
        const formattedStart = start_time.slice(0, 5);
        const symbols: Record<string, string> = {
          EUR: '€', GBP: '£', USD: '$', BRL: 'R$',
        };
        const symbol = symbols[professional.currency] || professional.currency;
        const formattedPrice = `${symbol}${Number(service.price).toFixed(0)}`;

        const message =
          `Olá ${client_name}! Seu agendamento foi confirmado 🎉\n` +
          `\n📅 ${formattedDate} às ${formattedStart}` +
          `\n✂️ ${service.name} — ${formattedPrice}` +
          `\n\nNos vemos em breve! 😊`;

        await safeSendWhatsApp(
          async () => {
            if (
              config.evolution_api_url &&
              config.evolution_api_key &&
              config.evolution_instance
            ) {
              await sendEvolutionMessage(client_phone, message, {
                apiUrl: config.evolution_api_url,
                apiKey: config.evolution_api_key,
                instance: config.evolution_instance,
              });
            }
            // Sistema usa apenas Evolution API (conversacional)
          },
          {
            onFailure: (error) => {
              void (async () => {
                try {
                  await supabase.from('notification_logs').insert({
                    professional_id,
                    booking_id: booking.id,
                    type: 'booking_confirmation',
                    channel: 'whatsapp',
                    recipient: client_phone,
                    message,
                    status: 'failed',
                    error_message: error,
                  });
                } catch { /* nunca quebrar o fluxo */ }
              })();
            },
          }
        );
      })();
    }
  }

  return NextResponse.json(
    { booking, message: 'Agendamento criado com sucesso!' },
    { status: 201 }
  );
}
