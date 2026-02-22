import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendBookingConfirmationEmail } from '@/lib/resend';

export async function POST(request: Request) {
  // Auth: profissional autenticado
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: professional } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!professional) {
    return NextResponse.json({ error: 'Professional not found' }, { status: 404 });
  }

  const { log_id } = await request.json();
  if (!log_id) {
    return NextResponse.json({ error: 'log_id is required' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Buscar entrada em notification_logs — verificar que pertence ao profissional
  const { data: log } = await admin
    .from('notification_logs')
    .select('*')
    .eq('id', log_id)
    .eq('professional_id', professional.id)
    .eq('channel', 'email')
    .single();

  if (!log) {
    return NextResponse.json({ error: 'Log not found or access denied' }, { status: 404 });
  }

  if (!log.booking_id) {
    return NextResponse.json({ error: 'Log has no associated booking' }, { status: 422 });
  }

  // Buscar dados completos do agendamento
  const { data: booking } = await admin
    .from('bookings')
    .select(
      'id, client_name, client_email, booking_date, start_time, end_time, professional_id, services(name, price)',
    )
    .eq('id', log.booking_id)
    .single();

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const { data: prof } = await admin
    .from('professionals')
    .select('business_name, currency, user_id')
    .eq('id', booking.professional_id)
    .single();

  if (!prof) {
    return NextResponse.json({ error: 'Professional data not found' }, { status: 404 });
  }

  const { data: userData } = await admin.auth.admin.getUserById(prof.user_id);
  if (!userData?.user?.email) {
    return NextResponse.json({ error: 'Professional email not found' }, { status: 404 });
  }

  const service = (booking as any).services;

  // Reenviar email
  await sendBookingConfirmationEmail({
    clientName: booking.client_name,
    clientEmail: booking.client_email ?? undefined,
    professionalEmail: userData.user.email,
    businessName: prof.business_name,
    serviceName: service?.name ?? 'Serviço',
    servicePrice: service?.price ?? 0,
    currency: prof.currency,
    bookingDate: booking.booking_date,
    startTime: booking.start_time,
    endTime: booking.end_time,
    bookingId: booking.id,
    professionalId: booking.professional_id,
  });

  return NextResponse.json({ success: true, message: 'Reenvio iniciado' });
}
