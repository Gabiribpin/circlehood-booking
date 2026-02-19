import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

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

    if (!booking.client_phone) {
      return NextResponse.json({ error: 'No client phone' }, { status: 400 });
    }

    // 4. Buscar config WhatsApp ativa
    const { data: wc } = await supabase
      .from('whatsapp_config')
      .select('provider, phone_number_id, access_token, evolution_api_url, evolution_api_key, evolution_instance, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (!wc) {
      return NextResponse.json({ error: 'WhatsApp not configured' }, { status: 400 });
    }

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

    // 6. Enviar via WhatsApp (Evolution ou Meta)
    let sent = false;

    if (wc.provider === 'evolution' && wc.evolution_api_url && wc.evolution_instance) {
      const normalized = booking.client_phone.replace(/[^0-9]/g, '');
      const res = await fetch(`${wc.evolution_api_url}/message/sendText/${wc.evolution_instance}`, {
        method: 'POST',
        headers: { apikey: wc.evolution_api_key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: normalized, text: message }),
      });
      sent = res.ok;
      if (!sent) console.error('[cancel-notification] Evolution error:', res.status, await res.text());
    }

    if (!sent && wc.provider === 'meta' && wc.phone_number_id) {
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
      sent = res.ok;
      if (!sent) console.error('[cancel-notification] Meta error:', res.status, await res.text());
    }

    if (!sent) {
      return NextResponse.json({ error: 'Failed to send WhatsApp message' }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[cancel-notification] Erro:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
