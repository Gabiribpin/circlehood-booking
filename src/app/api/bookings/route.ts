import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendBookingConfirmationEmail } from '@/lib/resend';

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
  } = body;

  if (!professional_id || !service_id || !booking_date || !start_time || !client_name) {
    return NextResponse.json(
      { error: 'Missing required fields' },
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
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: 'Failed to create booking' },
      { status: 500 }
    );
  }

  // Get professional info for email
  const { data: professional } = await supabase
    .from('professionals')
    .select('user_id, business_name, currency')
    .eq('id', professional_id)
    .single();

  if (professional) {
    // Get professional's auth email
    const { data: userData } = await supabase.auth.admin.getUserById(
      professional.user_id
    );

    if (userData?.user?.email) {
      // Fire and forget - don't block response
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
      }).catch(() => {
        console.error('Failed to send booking emails');
      });
    }
  }

  return NextResponse.json({ booking }, { status: 201 });
}
