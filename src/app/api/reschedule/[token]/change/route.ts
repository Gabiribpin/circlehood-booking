import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json();
  const { new_date, new_time } = body;

  const supabase = await createClient();

  try {
    // Validar token
    const { data: tokenData, error: tokenError } = await supabase
      .from('reschedule_tokens')
      .select('*, bookings(id, professional_id, service_id, status)')
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

    // Verificar se novo horário está disponível
    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('professional_id', tokenData.bookings.professional_id)
      .eq('booking_date', new_date)
      .eq('booking_time', new_time)
      .eq('status', 'confirmed')
      .single();

    if (existingBooking) {
      return NextResponse.json({ error: 'Horário não disponível' }, { status: 409 });
    }

    // Atualizar booking
    const { data: updatedBooking, error: updateError } = await supabase
      .from('bookings')
      .update({
        booking_date: new_date,
        booking_time: new_time,
      })
      .eq('id', tokenData.bookings.id)
      .select('*, services(name, price), professionals(business_name)')
      .single();

    if (updateError) throw updateError;

    // Marcar token como usado
    await supabase
      .from('reschedule_tokens')
      .update({
        used: true,
        used_at: new Date().toISOString(),
      })
      .eq('id', tokenData.id);

    // Criar novo token para o booking atualizado
    await supabase.from('reschedule_tokens').insert({
      booking_id: tokenData.bookings.id,
    });

    // Notificar profissional
    await supabase.from('notification_queue').insert({
      professional_id: tokenData.bookings.professional_id,
      type: 'booking_confirmation',
      recipient_name: 'Profissional',
      recipient_phone: '',
      message_template: 'booking_rescheduled',
      message_data: {
        booking_id: tokenData.bookings.id,
        new_date,
        new_time,
      },
      language: 'pt',
    });

    return NextResponse.json({
      success: true,
      message: 'Agendamento reagendado com sucesso',
      booking: updatedBooking,
    });
  } catch (error: any) {
    console.error('Error rescheduling booking:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
