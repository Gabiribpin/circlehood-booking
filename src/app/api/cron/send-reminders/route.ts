import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// Templates de mensagem por idioma
const MESSAGE_TEMPLATES = {
  pt: {
    reminder: `Olá {name}! 👋

Lembrando que você tem agendamento amanhã:
📅 {date} às {time}
✂️ {service}
💰 €{price}
📍 {location}

Nos vemos lá! 💜

{reschedule_link}`,
  },
  en: {
    reminder: `Hi {name}! 👋

Reminder: You have an appointment tomorrow:
📅 {date} at {time}
✂️ {service}
💰 €{price}
📍 {location}

See you there! 💜

{reschedule_link}`,
  },
  es: {
    reminder: `¡Hola {name}! 👋

Te recuerdo que tienes cita mañana:
📅 {date} a las {time}
✂️ {service}
💰 €{price}
📍 {location}

¡Nos vemos! 💜

{reschedule_link}`,
  },
};

function formatMessage(template: string, data: Record<string, any>): string {
  let message = template;
  Object.keys(data).forEach((key) => {
    message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), data[key]);
  });
  return message;
}

function detectLanguage(phone: string): 'pt' | 'en' | 'es' {
  if (phone.startsWith('+55')) return 'pt'; // Brasil
  if (phone.startsWith('+351')) return 'pt'; // Portugal
  if (phone.startsWith('+34')) return 'es'; // Espanha
  if (phone.startsWith('+52')) return 'es'; // México
  if (phone.startsWith('+54')) return 'es'; // Argentina
  return 'en'; // Default
}

export async function POST(request: NextRequest) {
  // Verificar autorização do cron
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.error('Unauthorized cron attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = await createClient();

  try {
    // Buscar bookings de amanhã que ainda não tiveram lembrete enviado
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(
        `
        id,
        booking_date,
        booking_time,
        contact_name,
        contact_phone,
        contact_email,
        status,
        professional_id,
        service_id,
        services (name, price),
        professionals (business_name, slug, city, address)
      `
      )
      .eq('booking_date', tomorrowStr)
      .eq('status', 'confirmed')
      .eq('reminder_sent', false);

    if (bookingsError) {
      throw new Error(`Error fetching bookings: ${bookingsError.message}`);
    }

    if (!bookings || bookings.length === 0) {
      // Log sucesso mesmo sem lembretes
      await supabase.from('cron_logs').insert({
        job_name: 'send-reminders',
        status: 'success',
        records_processed: 0,
        execution_time_ms: Date.now() - startTime,
        metadata: { date: tomorrowStr, message: 'No reminders to send' },
      });

      return NextResponse.json({
        success: true,
        remindersSent: 0,
        message: 'No reminders to send',
      });
    }

    const remindersSent = [];
    const errors = [];

    // Processar cada booking
    for (const booking of bookings) {
      try {
        const language = detectLanguage(booking.contact_phone);

        // Buscar token de reagendamento
        const { data: tokenData } = await supabase
          .from('reschedule_tokens')
          .select('token')
          .eq('booking_id', booking.id)
          .single();

        const rescheduleLink = tokenData
          ? `\n\nPara reagendar ou cancelar:\nhttps://circlehood-booking.vercel.app/reschedule/${tokenData.token}`
          : '';

        // Formatar mensagem
        const message = formatMessage(MESSAGE_TEMPLATES[language].reminder, {
          name: booking.contact_name,
          date: new Date(booking.booking_date).toLocaleDateString('pt-BR'),
          time: booking.booking_time.substring(0, 5),
          service: (booking.services as any)?.name || 'Serviço',
          price: (booking.services as any)?.price || '0',
          location:
            (booking.professionals as any)?.address ||
            `${(booking.professionals as any)?.city || 'Dublin'}`,
          reschedule_link: rescheduleLink,
        });

        // Adicionar na fila de notificações
        await supabase.from('notification_queue').insert({
          professional_id: booking.professional_id,
          type: 'reminder',
          recipient_name: booking.contact_name,
          recipient_phone: booking.contact_phone,
          recipient_email: booking.contact_email,
          message_template: 'reminder',
          message_data: {
            booking_id: booking.id,
            message: message,
          },
          language: language,
          status: 'pending',
        });

        // Marcar lembrete como enviado
        await supabase
          .from('bookings')
          .update({
            reminder_sent: true,
            reminder_sent_at: new Date().toISOString(),
          })
          .eq('id', booking.id);

        // Registrar log
        await supabase.from('notification_logs').insert({
          professional_id: booking.professional_id,
          booking_id: booking.id,
          type: 'reminder',
          channel: 'whatsapp',
          recipient: booking.contact_phone,
          message: message,
          status: 'sent',
        });

        remindersSent.push({
          booking_id: booking.id,
          contact: booking.contact_name,
          language,
        });
      } catch (error: any) {
        console.error(`Error processing booking ${booking.id}:`, error);
        errors.push({
          booking_id: booking.id,
          error: error.message,
        });
      }
    }

    // Log do cron job
    await supabase.from('cron_logs').insert({
      job_name: 'send-reminders',
      status: errors.length > 0 ? 'error' : 'success',
      records_processed: remindersSent.length,
      records_failed: errors.length,
      execution_time_ms: Date.now() - startTime,
      metadata: {
        date: tomorrowStr,
        reminders_sent: remindersSent,
        errors: errors,
      },
    });

    return NextResponse.json({
      success: true,
      remindersSent: remindersSent.length,
      errors: errors.length,
      details: {
        sent: remindersSent,
        errors: errors,
      },
    });
  } catch (error: any) {
    console.error('Fatal error in send-reminders cron:', error);

    // Log erro
    await supabase.from('cron_logs').insert({
      job_name: 'send-reminders',
      status: 'error',
      error_message: error.message,
      execution_time_ms: Date.now() - startTime,
    });

    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
