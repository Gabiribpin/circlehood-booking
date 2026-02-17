import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json();
  const { reason } = body;

  const supabase = await createClient();

  try {
    // Validar token
    const { data: tokenData, error: tokenError } = await supabase
      .from('reschedule_tokens')
      .select('*, bookings(id, professional_id, status)')
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

    // Notificar profissional
    await supabase.from('notification_queue').insert({
      professional_id: tokenData.bookings.professional_id,
      type: 'booking_confirmation',
      recipient_name: 'Profissional',
      recipient_phone: '',
      message_template: 'booking_cancelled',
      message_data: {
        booking_id: tokenData.bookings.id,
        reason: reason || 'Cancelado pelo cliente',
      },
      language: 'pt',
    });

    return NextResponse.json({
      success: true,
      message: 'Agendamento cancelado com sucesso',
    });
  } catch (error: any) {
    console.error('Error cancelling booking:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
