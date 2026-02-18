import { createClient } from '@supabase/supabase-js';

export async function notifyWaitlist(
  bookingId: string,
  professionalId: string
): Promise<number> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1. Buscar dados do booking cancelado (data, horário, serviço)
  const { data: cancelledBooking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, booking_date, start_time, services(name)')
    .eq('id', bookingId)
    .single();

  if (bookingError || !cancelledBooking) {
    console.error('notifyWaitlist: cancelled booking not found', bookingError);
    return 0;
  }

  // 2. Buscar user_id do profissional (necessário para notifications.user_id)
  const { data: professional, error: profError } = await supabase
    .from('professionals')
    .select('user_id')
    .eq('id', professionalId)
    .single();

  if (profError || !professional) {
    console.error('notifyWaitlist: professional not found', profError);
    return 0;
  }

  // 3. Buscar todos os bookings em waitlist para a mesma data, por ordem de criação
  const { data: waitlistBookings, error: waitlistError } = await supabase
    .from('bookings')
    .select('id, client_name, contact_id, created_at')
    .eq('professional_id', professionalId)
    .eq('booking_date', cancelledBooking.booking_date)
    .eq('status', 'waitlist')
    .order('created_at', { ascending: true });

  if (waitlistError) {
    console.error('notifyWaitlist: error fetching waitlist', waitlistError);
    return 0;
  }

  if (!waitlistBookings || waitlistBookings.length === 0) {
    return 0;
  }

  const time = (cancelledBooking.start_time as string).slice(0, 5);
  const date = cancelledBooking.booking_date as string;

  const servicesData = cancelledBooking.services as
    | { name: string }[]
    | { name: string }
    | null;
  const serviceName = Array.isArray(servicesData)
    ? (servicesData[0]?.name ?? 'Serviço')
    : (servicesData?.name ?? 'Serviço');

  let notified = 0;

  // 4. Criar notificação para cada pessoa na fila (sem duplicatas)
  for (const waitlistBooking of waitlistBookings) {
    // Verificar se já existe notificação para este par (vaga liberada + pessoa na fila)
    const { data: existing } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', professional.user_id)
      .eq('type', 'waitlist')
      .filter('metadata->>cancelled_booking_id', 'eq', bookingId)
      .filter('metadata->>waitlist_booking_id', 'eq', waitlistBooking.id)
      .maybeSingle();

    if (existing) continue;

    const { error: insertError } = await supabase
      .from('notifications')
      .insert({
        user_id: professional.user_id,
        client_id: waitlistBooking.contact_id ?? null,
        type: 'waitlist',
        title: 'Vaga Disponível!',
        message: `Horário às ${time} (${serviceName}) ficou livre no dia ${date}. Deseja confirmar para ${waitlistBooking.client_name}?`,
        scheduled_for: new Date().toISOString(), // Notificação imediata
        status: 'pending',
        channel: 'whatsapp',
        metadata: {
          cancelled_booking_id: bookingId,
          waitlist_booking_id: waitlistBooking.id,
          client_name: waitlistBooking.client_name,
          date,
          time,
          service_name: serviceName,
        },
      });

    if (insertError) {
      console.error(
        `notifyWaitlist: error inserting notification for ${waitlistBooking.client_name}`,
        insertError
      );
      continue;
    }

    notified++;
  }

  return notified;
}
