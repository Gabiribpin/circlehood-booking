import { logger } from '@/lib/logger';
import { isRateLimited } from '@/lib/rate-limit';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const rescheduleSchema = z.object({
  new_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').refine((val) => {
    const [y, m, d] = val.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  }, 'Invalid date'),
  new_time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format').refine((val) => {
    const [h, m] = val.split(':').map(Number);
    return h >= 0 && h <= 23 && m >= 0 && m <= 59;
  }, 'Time must be between 00:00 and 23:59'),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await request.json();

  const parsed = rescheduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
  }
  const { new_date, new_time } = parsed.data;

  const supabase = createAdminClient();

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

    // Rate limit per booking: max 5 reschedules per hour
    if (await isRateLimited(`rl:reschedule:${tokenData.bookings.id}`, 5, 3600)) {
      return NextResponse.json(
        { error: 'Muitas tentativas de reagendamento. Tente novamente mais tarde.' },
        { status: 429 }
      );
    }

    // Rejeitar datas no passado
    const now = new Date();
    const requestedDate = new Date(`${new_date}T${new_time}:00`);
    if (requestedDate <= now) {
      return NextResponse.json({ error: 'Não é possível reagendar para uma data/horário no passado' }, { status: 400 });
    }

    // Verificar working hours do profissional
    const dateObj = new Date(`${new_date}T00:00:00`);
    const dayOfWeek = dateObj.getDay();

    const { data: workingHours } = await supabase
      .from('working_hours')
      .select('start_time, end_time')
      .eq('professional_id', tokenData.bookings.professional_id)
      .eq('day_of_week', dayOfWeek);

    if (!workingHours || workingHours.length === 0) {
      return NextResponse.json({ error: 'Profissional não atende neste dia da semana' }, { status: 400 });
    }

    const requestedTime = `${new_time}:00`;
    const withinWorkingHours = workingHours.some(
      (wh) => requestedTime >= wh.start_time && requestedTime < wh.end_time
    );

    if (!withinWorkingHours) {
      return NextResponse.json({ error: 'Horário fora do expediente do profissional' }, { status: 400 });
    }

    // Verificar se novo horário está disponível
    const { data: existingBooking } = await supabase
      .from('bookings')
      .select('id')
      .eq('professional_id', tokenData.bookings.professional_id)
      .eq('booking_date', new_date)
      .eq('start_time', new_time)
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
        start_time: new_time,
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

    // Invalidar old unused tokens for this booking (prevent accumulation)
    await supabase
      .from('reschedule_tokens')
      .update({ used: true, used_at: new Date().toISOString() })
      .eq('booking_id', tokenData.bookings.id)
      .eq('used', false)
      .neq('id', tokenData.id);

    // Criar novo token para o booking atualizado
    await supabase.from('reschedule_tokens').insert({
      booking_id: tokenData.bookings.id,
    });

    return NextResponse.json({
      success: true,
      message: 'Agendamento reagendado com sucesso',
      booking: updatedBooking,
    });
  } catch (error: any) {
    logger.error('Error rescheduling booking:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
