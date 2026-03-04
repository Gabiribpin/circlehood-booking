import { logger } from '@/lib/logger';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { normalizePhoneForWhatsApp } from '@/lib/whatsapp/evolution';

function detectLanguageFromPhone(phone: string): 'pt' | 'en' {
  // Aceita com ou sem '+' (ex: '+5511...' e '5511...' são ambos Brasil)
  const clean = phone.replace(/\D/g, '');
  if (
    phone.startsWith('+55') || phone.startsWith('+351') ||
    clean.startsWith('55') || clean.startsWith('351')
  ) return 'pt';
  return 'en';
}

/** Determina idioma: locale do profissional > prefixo do telefone */
function resolveLanguage(professionalLocale: string | null | undefined, phone: string): 'pt' | 'en' {
  if (professionalLocale) {
    if (professionalLocale.startsWith('pt')) return 'pt';
    if (professionalLocale.startsWith('en')) return 'en';
    if (professionalLocale.startsWith('es')) return 'pt'; // espanhol → template PT (mais próximo)
  }
  return detectLanguageFromPhone(phone);
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
    logger.error('Unauthorized cron attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  // Service role — sem sessão de usuário; contorna RLS
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

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
      .not('completed_at', 'is', null)
      .not('client_name', 'ilike', '[E2E]%')
      .not('client_name', 'ilike', 'E2E %');

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

    // Coletar professional_ids únicos e buscar configs WhatsApp em batch
    const professionalIds = [...new Set(candidates.map((b) => b.professional_id))];

    const { data: professionals } = await supabase
      .from('professionals')
      .select('id, user_id, locale')
      .in('id', professionalIds);

    const profMap = new Map((professionals ?? []).map((p) => [p.id, { user_id: p.user_id, locale: p.locale }]));

    const userIds = (professionals ?? []).map((p) => p.user_id).filter(Boolean) as string[];
    const { data: whatsappConfigs } = await supabase
      .from('whatsapp_config')
      .select('user_id, provider, evolution_api_url, evolution_api_key, evolution_instance, phone_number_id, access_token, is_active')
      .in('user_id', userIds)
      .eq('is_active', true);

    // Map: user_id → whatsapp_config
    const wcMap = new Map((whatsappConfigs ?? []).map((wc) => [wc.user_id, wc]));

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

        // Obter config do profissional
        const profInfo = profMap.get(booking.professional_id);
        const userId = profInfo?.user_id;
        const wc = userId ? wcMap.get(userId) : undefined;

        const lang = resolveLanguage(profInfo?.locale, phone);
        const message = MESSAGE_TEMPLATES[lang](
          booking.client_name,
          service.lifetime_days,
          service.name
        );

        let sent = false;

        if (wc && wc.provider === 'evolution' && wc.evolution_api_url && wc.evolution_instance) {
          const normalized = normalizePhoneForWhatsApp(phone);
          try {
            const res = await fetch(
              `${wc.evolution_api_url}/message/sendText/${wc.evolution_instance}`,
              {
                method: 'POST',
                headers: { apikey: wc.evolution_api_key, 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: normalized, text: message }),
              }
            );
            sent = res.ok;
            if (!sent) {
              logger.error('[maintenance-reminders] Evolution error:', res.status, await res.text());
            }
          } catch (sendErr: any) {
            logger.error('[maintenance-reminders] Evolution fetch error:', sendErr.message);
          }
        } else if (wc && wc.provider === 'meta' && wc.phone_number_id) {
          try {
            const res = await fetch(
              `https://graph.facebook.com/v18.0/${wc.phone_number_id}/messages`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${wc.access_token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  messaging_product: 'whatsapp',
                  to: phone,
                  type: 'text',
                  text: { body: message },
                }),
              }
            );
            sent = res.ok;
            if (!sent) {
              logger.error('[maintenance-reminders] Meta error:', res.status, await res.text());
            }
          } catch (sendErr: any) {
            logger.error('[maintenance-reminders] Meta fetch error:', sendErr.message);
          }
        }

        // Registrar em notification_logs
        await supabase.from('notification_logs').insert({
          professional_id: booking.professional_id,
          booking_id: booking.id,
          type: 'maintenance_reminder',
          channel: 'whatsapp',
          recipient: phone,
          message,
          status: sent ? 'sent' : 'failed',
          error_message: sent ? null : 'WhatsApp not configured or send failed',
        });

        // Marcar lembrete como enviado independente do resultado
        // (para não tentar novamente no próximo dia)
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
          sent,
        });
      } catch (error: any) {
        logger.error(`Error processing booking ${booking.id}:`, error);
        errors.push({ booking_id: booking.id, error: 'Processing failed' });
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
        professional_ids: professionalIds,
        reminders_sent: remindersSent,
        errors,
      },
    } as never);

    return NextResponse.json({
      success: true,
      remindersSent: remindersSent.length,
      errors: errors.length,
      details: { sent: remindersSent, errors },
    });
  } catch (error: any) {
    logger.error('Fatal error in send-maintenance-reminders cron:', error);

    await supabase.from('cron_logs').insert({
      job_name: 'send-maintenance-reminders',
      status: 'error',
      error_message: error.message,
      execution_time_ms: Date.now() - startTime,
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
