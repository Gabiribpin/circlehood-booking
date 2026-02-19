import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { formatTemplate } from '@/lib/notifications/templates';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const cronSecret = request.headers.get('x-cron-secret');
  if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = await createClient();

  try {
    // Buscar notificações pendentes (limite 10 por vez)
    const { data: notifications, error: fetchError } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(10);

    if (fetchError) throw fetchError;

    if (!notifications || notifications.length === 0) {
      return NextResponse.json({ processed: 0, message: 'No notifications to send' });
    }

    const results = [];

    for (const notification of notifications) {
      try {
        // Processar notificação baseada no tipo
        const messageData = notification.message_data || {};

        // Enviar via WhatsApp (wa.me - manual)
        // Note: wa.me requer ação do profissional, então apenas logamos
        await supabase.from('notification_logs').insert({
          professional_id: notification.professional_id,
          booking_id: messageData.booking_id,
          type: notification.type,
          channel: 'whatsapp',
          recipient: notification.recipient_phone,
          message: messageData.message || '',
          status: 'sent',
        });

        // Enviar email se tiver email
        if (notification.recipient_email && resend) {
          try {
            const emailSubject = formatTemplate(
              notification.type as any,
              'email_subject',
              notification.language as any,
              messageData
            );

            const emailBody = formatTemplate(
              notification.type as any,
              'email_body',
              notification.language as any,
              messageData
            );

            await resend.emails.send({
              from: 'CircleHood <noreply@circlehood-tech.com>',
              to: notification.recipient_email,
              subject: emailSubject,
              html: emailBody,
            });

            await supabase.from('notification_logs').insert({
              professional_id: notification.professional_id,
              booking_id: messageData.booking_id,
              type: notification.type,
              channel: 'email',
              recipient: notification.recipient_email,
              message: emailSubject,
              status: 'sent',
            });
          } catch (emailError) {
            console.error('Email error:', emailError);
          }
        }

        // Marcar como enviado
        await supabase
          .from('notification_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', notification.id);

        results.push({ id: notification.id, status: 'sent' });
      } catch (error: any) {
        console.error(`Error processing notification ${notification.id}:`, error);

        // Marcar como falhou
        await supabase
          .from('notification_queue')
          .update({
            status: 'failed',
            error_message: error.message,
            retry_count: notification.retry_count + 1,
          })
          .eq('id', notification.id);

        results.push({ id: notification.id, status: 'failed', error: error.message });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error: any) {
    console.error('Error in notification sender:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
