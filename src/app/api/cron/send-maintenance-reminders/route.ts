import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

function detectLanguage(phone: string): 'pt' | 'en' {
  if (phone.startsWith('+55') || phone.startsWith('+351')) return 'pt';
  return 'en';
}

const MESSAGE_TEMPLATES = {
  pt: (name: string, days: number, service: string) =>
    `Olá ${name}! Já faz ${days} dias desde seu último ${service} 😊 Que tal marcarmos de novo? Estou à disposição! 💅`,
  en: (name: string, days: number, service: string) =>
    `Hi ${name}! It's been ${days} days since your last ${service} 😊 Ready to book again? I'm here to help! 💅`,
};

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.error('Unauthorized cron attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = await createClient();

  try {
    // Usar timezone de Dublin para evitar bugs de UTC vs local time
    const dublinNow = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Europe/Dublin' })
    );
    const today = [
      dublinNow.getFullYear(),
      String(dublinNow.getMonth() + 1).padStart(2, '0'),
      String(dublinNow.getDate()).padStart(2, '0'),
    ].join('-'); // YYYY-MM-DD em horário de Dublin

    // Buscar bookings concluídos que ainda não tiveram lembrete de manutenção,
    // com join em services para obter lifetime_days
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select(
        `id, professional_id, service_id, client_name, client_phone, completed_at,
         services ( name, lifetime_days )`
      )
      .eq('status', 'completed')
      .eq('maintenance_reminder_sent', false)
      .not('completed_at', 'is', null);

    if (bookingsError) {
      throw new Error(`Error fetching bookings: ${bookingsError.message}`);
    }

    if (!bookings || bookings.length === 0) {
      await supabase.from('cron_logs').insert({
        job_name: 'send-maintenance-reminders',
        status: 'success',
        records_processed: 0,
        execution_time_ms: Date.now() - startTime,
        metadata: { date: today, message: 'No candidates found' },
      });

      return NextResponse.json({
        success: true,
        remindersSent: 0,
        message: 'No candidates found',
      });
    }

    // Filtrar: completed_at + lifetime_days === today
    const candidates = bookings.filter((b) => {
      const service = b.services as any;
      if (!service?.lifetime_days || !b.completed_at) return false;

      const completedDate = new Date(b.completed_at);
      completedDate.setDate(completedDate.getDate() + service.lifetime_days);
      // Converter para data de Dublin (evita bug UTC onde meia-noite muda o dia)
      const dueDateDublin = new Date(
        completedDate.toLocaleString('en-US', { timeZone: 'Europe/Dublin' })
      );
      const dueDate = [
        dueDateDublin.getFullYear(),
        String(dueDateDublin.getMonth() + 1).padStart(2, '0'),
        String(dueDateDublin.getDate()).padStart(2, '0'),
      ].join('-');
      return dueDate === today;
    });

    if (candidates.length === 0) {
      await supabase.from('cron_logs').insert({
        job_name: 'send-maintenance-reminders',
        status: 'success',
        records_processed: 0,
        execution_time_ms: Date.now() - startTime,
        metadata: { date: today, message: 'No reminders due today' },
      });

      return NextResponse.json({
        success: true,
        remindersSent: 0,
        message: 'No reminders due today',
      });
    }

    const remindersSent = [];
    const errors = [];

    for (const booking of candidates) {
      try {
        const service = booking.services as any;
        const phone = booking.client_phone;

        // Verificar se já tem agendamento futuro do mesmo serviço
        const { data: futureBookings } = await supabase
          .from('bookings')
          .select('id')
          .eq('professional_id', booking.professional_id)
          .eq('service_id', booking.service_id)
          .in('status', ['confirmed', 'pending'])
          .gte('booking_date', today)
          .limit(1);

        if (futureBookings && futureBookings.length > 0) {
          // Cliente já tem agendamento futuro — marcar como enviado para não verificar de novo
          await supabase
            .from('bookings')
            .update({ maintenance_reminder_sent: true, maintenance_reminder_sent_at: new Date().toISOString() })
            .eq('id', booking.id);
          continue;
        }

        if (!phone) {
          // Sem telefone — marcar para não processar de novo
          await supabase
            .from('bookings')
            .update({ maintenance_reminder_sent: true, maintenance_reminder_sent_at: new Date().toISOString() })
            .eq('id', booking.id);
          continue;
        }

        const lang = detectLanguage(phone);
        const message = MESSAGE_TEMPLATES[lang](
          booking.client_name,
          service.lifetime_days,
          service.name
        );

        // Adicionar à fila de notificações
        await supabase.from('notification_queue').insert({
          professional_id: booking.professional_id,
          type: 'maintenance_reminder',
          recipient_name: booking.client_name,
          recipient_phone: phone,
          recipient_email: null,
          message_template: 'maintenance_reminder',
          message_data: {
            booking_id: booking.id,
            message,
          },
          language: lang,
          status: 'pending',
        });

        // Marcar lembrete como enviado
        await supabase
          .from('bookings')
          .update({
            maintenance_reminder_sent: true,
            maintenance_reminder_sent_at: new Date().toISOString(),
          })
          .eq('id', booking.id);

        remindersSent.push({
          booking_id: booking.id,
          client: booking.client_name,
          service: service.name,
          language: lang,
        });
      } catch (error: any) {
        console.error(`Error processing booking ${booking.id}:`, error);
        errors.push({ booking_id: booking.id, error: error.message });
      }
    }

    await supabase.from('cron_logs').insert({
      job_name: 'send-maintenance-reminders',
      status: errors.length > 0 ? 'error' : 'success',
      records_processed: remindersSent.length,
      records_failed: errors.length,
      execution_time_ms: Date.now() - startTime,
      metadata: {
        date: today,
        reminders_sent: remindersSent,
        errors,
      },
    });

    return NextResponse.json({
      success: true,
      remindersSent: remindersSent.length,
      errors: errors.length,
      details: { sent: remindersSent, errors },
    });
  } catch (error: any) {
    console.error('Fatal error in send-maintenance-reminders cron:', error);

    await supabase.from('cron_logs').insert({
      job_name: 'send-maintenance-reminders',
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
