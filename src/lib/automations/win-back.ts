import { createClient } from '@supabase/supabase-js';

interface InactiveClient {
  id: string;
  name: string;
  phone: string;
  email?: string;
  lastBookingDate?: string;
  daysSinceLastVisit: number;
}

export async function detectInactiveClients(
  userId: string,
  days = 60
): Promise<InactiveClient[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Buscar professional_id do usuário
  const { data: professional, error: profError } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (profError || !professional) {
    console.error('Professional not found for user:', userId);
    return [];
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  // Buscar todos os contatos do profissional
  const { data: contacts, error: contactsError } = await supabase
    .from('contacts')
    .select('id, name, phone, email')
    .eq('professional_id', professional.id);

  if (contactsError || !contacts?.length) {
    console.error('Error fetching contacts:', contactsError);
    return [];
  }

  // Buscar agendamentos recentes (dentro do período de corte)
  const { data: recentBookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('client_phone, booking_date')
    .eq('professional_id', professional.id)
    .eq('status', 'confirmed')
    .gte('booking_date', cutoffStr)
    .order('booking_date', { ascending: false });

  if (bookingsError) {
    console.error('Error fetching bookings:', bookingsError);
    return [];
  }

  // Mapa: phone → última data de booking
  const lastBookingMap: Record<string, string> = {};
  for (const booking of recentBookings || []) {
    const phone = booking.client_phone?.replace(/\D/g, '');
    if (phone && !lastBookingMap[phone]) {
      lastBookingMap[phone] = booking.booking_date;
    }
  }

  // Buscar último booking de clientes inativos (para registrar na notificação)
  const { data: allBookings } = await supabase
    .from('bookings')
    .select('client_phone, booking_date')
    .eq('professional_id', professional.id)
    .eq('status', 'confirmed')
    .order('booking_date', { ascending: false });

  const lastBookingAllMap: Record<string, string> = {};
  for (const booking of allBookings || []) {
    const phone = booking.client_phone?.replace(/\D/g, '');
    if (phone && !lastBookingAllMap[phone]) {
      lastBookingAllMap[phone] = booking.booking_date;
    }
  }

  const now = new Date();
  const inactiveClients: InactiveClient[] = [];

  for (const contact of contacts) {
    const phone = contact.phone?.replace(/\D/g, '');
    if (!phone) continue;

    // Se tem booking recente, não é inativo
    if (lastBookingMap[phone]) continue;

    const lastBookingDate = lastBookingAllMap[phone];
    let daysSinceLastVisit = days; // mínimo se nunca veio

    if (lastBookingDate) {
      const lastDate = new Date(lastBookingDate);
      daysSinceLastVisit = Math.floor(
        (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    inactiveClients.push({
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      email: contact.email,
      lastBookingDate,
      daysSinceLastVisit,
    });
  }

  if (!inactiveClients.length) {
    return [];
  }

  // Criar notificações para cada cliente inativo
  const scheduledFor = new Date();
  scheduledFor.setHours(10, 0, 0, 0); // Enviar às 10h do dia atual

  const notifications = inactiveClients.map((client) => ({
    user_id: userId,
    client_id: client.id,
    type: 'inactive_client' as const,
    title: `${client.name} não volta há ${client.daysSinceLastVisit} dias`,
    message: `Olá ${client.name.split(' ')[0]}! Sentimos a sua falta 💕 Que tal agendar um horário?`,
    scheduled_for: scheduledFor.toISOString(),
    status: 'pending',
    channel: 'whatsapp',
    metadata: {
      client_phone: client.phone,
      days_inactive: client.daysSinceLastVisit,
      last_booking_date: client.lastBookingDate ?? null,
    },
  }));

  const { error: notifError } = await supabase
    .from('notifications')
    .upsert(notifications, {
      onConflict: 'user_id, client_id, type',
      ignoreDuplicates: true,
    });

  if (notifError) {
    console.error('Error creating win-back notifications:', notifError);
  }

  return inactiveClients;
}
