import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { notifyWaitlist } from '@/lib/automations/waitlist-notification';
import { sendCancellationEmail } from '@/lib/resend';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json();
  const { reason } = body;

  // Public token-based endpoint — use admin client to bypass RLS
  // (no user session available; access is controlled by the token itself)
  const supabase = createAdminClient();

  try {
    // Validar token
    const { data: tokenData, error: tokenError } = await supabase
      .from('reschedule_tokens')
      .select('*, bookings(id, professional_id, status, client_name, client_email, client_phone, booking_date, start_time, services(name))')
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json({ error: 'Token inválido' }, { status: 404 });
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Token expirado' }, { status: 410 });
    }

    if (tokenData.used) {
      return NextResponse.json({ error: 'Token já utilizado' }, { status: 410 });
    }

    if (!tokenData.bookings) {
      return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 });
    }

    if (tokenData.bookings.status === 'cancelled') {
      return NextResponse.json({ error: 'Agendamento já cancelado' }, { status: 400 });
    }

    // Cancelar booking
    const { error: cancelError } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_reason: reason || 'Cancelado pelo cliente',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', tokenData.bookings.id);

    if (cancelError) throw cancelError;

    // Marcar token como usado
    await supabase
      .from('reschedule_tokens')
      .update({
        used: true,
        used_at: new Date().toISOString(),
      })
      .eq('id', tokenData.id);

    // Notificar lista de espera automaticamente
    notifyWaitlist(tokenData.bookings.id, tokenData.bookings.professional_id).catch(
      (err) => logger.error('notifyWaitlist error:', err)
    );

    // Notificar cliente via email (fire-and-forget)
    const booking = tokenData.bookings as any;
    if (booking.client_email) {
      ;(async () => {
        try {
          const { data: prof } = await supabase
            .from('professionals')
            .select('business_name')
            .eq('id', booking.professional_id)
            .single();

          await sendCancellationEmail({
            clientName: booking.client_name,
            clientEmail: booking.client_email,
            businessName: prof?.business_name ?? 'Profissional',
            serviceName: booking.services?.name ?? 'serviço',
            bookingDate: booking.booking_date,
            startTime: booking.start_time,
            cancellationReason: reason || undefined,
            bookingId: booking.id,
            professionalId: booking.professional_id,
          });
        } catch (err) {
          logger.error('[token-cancel] Email cliente error:', err);
        }
      })();
    }

    return NextResponse.json({
      success: true,
      message: 'Agendamento cancelado com sucesso',
    });
  } catch (error: any) {
    logger.error('Error cancelling booking:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
