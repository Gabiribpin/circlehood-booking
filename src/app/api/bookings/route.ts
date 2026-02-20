import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendBookingConfirmationEmail } from '@/lib/resend';
import { WhatsAppClient } from '@/lib/whatsapp/client';
import { sendEvolutionMessage } from '@/lib/whatsapp/evolution';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    professional_id,
    service_id,
    booking_date,
    start_time,
    client_name,
    client_email,
    client_phone,
    notes,
    service_location,
    customer_address,
    customer_address_city,
  } = body;

  if (!professional_id || !service_id || !booking_date || !start_time || !client_name || !client_phone) {
    return NextResponse.json(
      { error: 'Missing required fields. WhatsApp is mandatory.' },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Check trial expiration
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

  // Get service details
  const { data: service } = await supabase
    .from('services')
    .select('duration_minutes, name, price')
    .eq('id', service_id)
    .single();

  if (!service) {
    return NextResponse.json({ error: 'Service not found' }, { status: 404 });
  }

  // Calculate end_time
  const [h, m] = start_time.split(':').map(Number);
  const totalMinutes = h * 60 + m + service.duration_minutes;
  const endH = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
  const endM = (totalMinutes % 60).toString().padStart(2, '0');
  const end_time = `${endH}:${endM}`;

  // Check for double-booking
  const { data: conflicts } = await supabase
    .from('bookings')
    .select('id')
    .eq('professional_id', professional_id)
    .eq('booking_date', booking_date)
    .eq('status', 'confirmed')
    .lt('start_time', end_time)
    .gt('end_time', start_time);

  if (conflicts && conflicts.length > 0) {
    return NextResponse.json(
      { error: 'Horario indisponível. Escolha outro horario.' },
      { status: 409 }
    );
  }

  // Insert booking
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
    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    );
  }

  // Get professional info for email + whatsapp
  const { data: professional } = await supabase
    .from('professionals')
    .select('user_id, business_name, currency')
    .eq('id', professional_id)
    .single();

  if (professional) {
    // 1. Email de confirmação (fire and forget)
    supabase.auth.admin.getUserById(professional.user_id).then(({ data: userData }) => {
      if (userData?.user?.email) {
        sendBookingConfirmationEmail({
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
        });
      }
    }).catch((err) => console.error('[Booking] Failed to fetch user for email:', err));

    // 2. WhatsApp de confirmação (fire and forget)
    if (client_phone) {
      (async () => {
        try {
          const { data: config } = await supabase
            .from('whatsapp_config')
            .select('provider, phone_number_id, access_token, evolution_api_url, evolution_api_key, evolution_instance')
            .eq('user_id', professional.user_id)
            .eq('is_active', true)
            .maybeSingle();

          if (!config) return;

          const formattedDate = booking_date.split('-').reverse().join('/');
          const formattedStart = start_time.slice(0, 5);
          const symbols: Record<string, string> = { EUR: '€', GBP: '£', USD: '$', BRL: 'R$' };
          const symbol = symbols[professional.currency] || professional.currency;
          const formattedPrice = `${symbol}${Number(service.price).toFixed(0)}`;

          const message =
            `Olá ${client_name}! Seu agendamento foi confirmado 🎉\n` +
            `\n📅 ${formattedDate} às ${formattedStart}` +
            `\n✂️ ${service.name} — ${formattedPrice}` +
            `\n\nNos vemos em breve! 😊`;

          if (config.provider === 'evolution' && config.evolution_api_url && config.evolution_api_key && config.evolution_instance) {
            await sendEvolutionMessage(client_phone, message, {
              apiUrl: config.evolution_api_url,
              apiKey: config.evolution_api_key,
              instance: config.evolution_instance,
            });
          } else if (config.phone_number_id && config.access_token) {
            const whatsapp = new WhatsAppClient({
              phoneNumberId: config.phone_number_id,
              accessToken: config.access_token,
            });
            await whatsapp.sendMessage(client_phone, message);
          }
        } catch (err) {
          console.error('[Booking] WhatsApp confirmation failed:', err);
        }
      })();
    }
  }

  return NextResponse.json({ booking }, { status: 201 });
}
