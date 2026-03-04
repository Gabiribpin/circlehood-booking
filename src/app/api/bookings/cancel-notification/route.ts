import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
import { sendCancellationEmail } from '@/lib/resend';
import { normalizePhoneForWhatsApp } from '@/lib/whatsapp/evolution';

export async function POST(request: NextRequest) {
  try {
    // 1. Verificar sessão do profissional
    const serverSupabase = await createServerClient();
    const { data: { user } } = await serverSupabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { bookingId, cancellationReason } = await request.json();
    if (!bookingId) return NextResponse.json({ error: 'bookingId required' }, { status: 400 });

    // 2. Admin client para ler whatsapp_config (service role)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 3. Buscar agendamento + verificar que pertence ao profissional autenticado
    const { data: booking } = await supabase
      .from('bookings')
      .select('*, services(name)')
      .eq('id', bookingId)
      .single();

    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    // Verificar ownership
    const { data: professional } = await supabase
      .from('professionals')
      .select('id, business_name, user_id')
      .eq('id', booking.professional_id)
      .single();

    if (!professional || professional.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!booking.client_phone && !booking.client_email) {
      return NextResponse.json({ error: 'No client contact method' }, { status: 400 });
    }

    // 4. Buscar config WhatsApp ativa
    const { data: wc } = await supabase
      .from('whatsapp_config')
      .select('provider, phone_number_id, access_token, evolution_api_url, evolution_api_key, evolution_instance, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    // wc pode ser null (WhatsApp não configurado) — email continua funcionando

    // 5. Montar mensagem
    const dateLabel = new Date(booking.booking_date + 'T12:00:00Z').toLocaleDateString('pt-BR', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
    });
    const timeLabel = booking.start_time.slice(0, 5);
    const serviceName = (booking.services as any)?.name ?? 'serviço';

    let message = `Olá ${booking.client_name}! 😔\n\n`;
    message += `Infelizmente precisamos cancelar seu agendamento:\n`;
    message += `📅 ${dateLabel} às ${timeLabel}\n`;
    message += `✂️ ${serviceName}\n\n`;
    if (cancellationReason) {
      message += `Motivo: ${cancellationReason}\n\n`;
    }
    message += `Pedimos desculpas pelo transtorno! 🙏\n\n`;
    message += `Gostaria de remarcar para outro dia? Estou à disposição para encontrar um novo horário que funcione para você! 😊`;

    // 6. Enviar via WhatsApp (Evolution ou Meta) — opcional, apenas se há phone
    let whatsappSent = false;

    if (booking.client_phone && wc) {
      if (wc.provider === 'evolution' && wc.evolution_api_url && wc.evolution_instance) {
        const normalized = normalizePhoneForWhatsApp(booking.client_phone);
        const evoUrl = `${wc.evolution_api_url}/message/sendText/${wc.evolution_instance}`;
        logger.info('[cancel-notification] WhatsApp attempt:', { raw: booking.client_phone, normalized, url: evoUrl, hasApiKey: !!wc.evolution_api_key });
        const res = await fetch(evoUrl, {
          method: 'POST',
          headers: { apikey: wc.evolution_api_key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: normalized, text: message }),
        });
        const resBody = await res.text();
        logger.info('[cancel-notification] WhatsApp response:', { status: res.status, ok: res.ok, body: resBody.slice(0, 300) });
        whatsappSent = res.ok;
        if (!whatsappSent) logger.error('[cancel-notification] Evolution error:', res.status, resBody);
      }

      if (!whatsappSent && wc.provider === 'meta' && wc.phone_number_id) {
        const res = await fetch(`https://graph.facebook.com/v18.0/${wc.phone_number_id}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${wc.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: booking.client_phone,
            type: 'text',
            text: { body: message },
          }),
        });
        whatsappSent = res.ok;
        if (!whatsappSent) logger.error('[cancel-notification] Meta error:', res.status, await res.text());
      }
    }

    // 7. Enviar email de cancelamento — se cliente tem email
    let emailSent = false;
    if (booking.client_email) {
      try {
        await sendCancellationEmail({
          clientName: booking.client_name,
          clientEmail: booking.client_email,
          businessName: professional.business_name,
          serviceName: (booking.services as any)?.name ?? 'serviço',
          bookingDate: booking.booking_date,
          startTime: booking.start_time,
          cancellationReason: cancellationReason || undefined,
          bookingId: booking.id,
          professionalId: booking.professional_id,
        });
        emailSent = true;
      } catch (emailErr) {
        logger.error('[cancel-notification] Email error:', emailErr);
      }
    }

    if (!whatsappSent && !emailSent) {
      return NextResponse.json({ error: 'Failed to send any notification' }, { status: 502 });
    }

    return NextResponse.json({ success: true, whatsappSent, emailSent });
  } catch (error: any) {
    logger.error('[cancel-notification] Erro:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
