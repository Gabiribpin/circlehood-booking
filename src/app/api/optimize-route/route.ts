import { logger } from '@/lib/logger';
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Booking {
  id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  region?: string;
}

interface Cluster {
  region: string;
  bookingCount: number;
  earliestTime: string;
  latestTime: string;
  gapMinutes: number;
}

interface Suggestion {
  region: string;
  message: string;
  freeSlots: string[];
  clientsToNotify: number;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function findFreeSlots(bookings: Booking[], slotDuration = 60): string[] {
  const sorted = [...bookings].sort((a, b) =>
    timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
  );

  const slots: string[] = [];
  const workdayStart = timeToMinutes('09:00');
  const workdayEnd = timeToMinutes('19:00');

  // Check gap before first booking
  const firstStart = timeToMinutes(sorted[0].start_time);
  if (firstStart - workdayStart >= slotDuration) {
    slots.push(minutesToTime(workdayStart));
  }

  // Check gaps between bookings
  for (let i = 0; i < sorted.length - 1; i++) {
    const gapStart = timeToMinutes(sorted[i].end_time);
    const gapEnd = timeToMinutes(sorted[i + 1].start_time);
    if (gapEnd - gapStart >= slotDuration) {
      slots.push(minutesToTime(gapStart));
    }
  }

  // Check gap after last booking
  const lastEnd = timeToMinutes(sorted[sorted.length - 1].end_time);
  if (workdayEnd - lastEnd >= slotDuration) {
    slots.push(minutesToTime(lastEnd));
  }

  return slots.slice(0, 3); // Return up to 3 free slots
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth: require logged-in user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve professional and verify ownership
    const { data: professional } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!professional) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { date } = await request.json();
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Fetch bookings for the date — only for the authenticated professional
    // No PII fields (client_name, client_phone) in the select
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('id, booking_date, start_time, end_time, client_phone')
      .eq('professional_id', professional.id)
      .eq('booking_date', targetDate)
      .eq('status', 'confirmed')
      .order('start_time', { ascending: true });

    if (error) {
      return Response.json({ error: 'Failed to fetch bookings' }, { status: 500 });
    }

    if (!bookings?.length) {
      return Response.json({
        date: targetDate,
        clusters: [],
        suggestions: [],
        potentialSavings: '0 minutos',
        message: 'Nenhum agendamento encontrado para esta data.',
      });
    }

    // Enrich bookings with client region (phone needed only for region lookup, not returned)
    const phones = bookings.map((b) => b.client_phone).filter(Boolean);

    const { data: contacts } = await supabase
      .from('contacts')
      .select('phone, regions')
      .eq('professional_id', professional.id)
      .in('phone', phones);

    const phoneToRegion: Record<string, string> = {};
    for (const contact of contacts || []) {
      if (contact.regions?.length) {
        phoneToRegion[contact.phone] = contact.regions[0];
      }
    }

    const enrichedBookings: Booking[] = bookings.map((b) => ({
      id: b.id,
      booking_date: b.booking_date,
      start_time: b.start_time,
      end_time: b.end_time,
      region: phoneToRegion[b.client_phone] || 'Sem região',
    }));

    // Group by region
    const grouped: Record<string, Booking[]> = {};
    for (const booking of enrichedBookings) {
      const region = booking.region!;
      if (!grouped[region]) grouped[region] = [];
      grouped[region].push(booking);
    }

    // Build clusters (regions with bookings)
    const clusters: Cluster[] = [];
    const suggestions: Suggestion[] = [];
    let totalSavingsMinutes = 0;

    for (const [region, regionBookings] of Object.entries(grouped)) {
      if (region === 'Sem região') continue;

      const sorted = [...regionBookings].sort((a, b) =>
        timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
      );

      const earliestTime = sorted[0].start_time.slice(0, 5);
      const latestTime = sorted[sorted.length - 1].end_time.slice(0, 5);
      const spanMinutes =
        timeToMinutes(latestTime) - timeToMinutes(earliestTime);

      clusters.push({
        region,
        bookingCount: regionBookings.length,
        earliestTime,
        latestTime,
        gapMinutes: spanMinutes,
      });

      const freeSlots = findFreeSlots(sorted);

      // Count how many clients of this region are not yet booked today
      const { count: unbookedCount } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('professional_id', professional.id)
        .contains('regions', [region]);

      const alreadyBooked = regionBookings.length;
      const clientsToNotify = Math.max(0, (unbookedCount || 0) - alreadyBooked);

      if (freeSlots.length > 0 && clientsToNotify > 0) {
        const slotsText = freeSlots.map((s) => `${s}h`).join(', ');

        suggestions.push({
          region,
          message:
            regionBookings.length >= 2
              ? `Você tem ${regionBookings.length} atendimentos em ${region} entre ${earliestTime} e ${latestTime}. Aproveite e agende mais ${Math.min(clientsToNotify, 2)} cliente${clientsToNotify !== 1 ? 's' : ''} às ${slotsText}!`
              : `Você tem 1 atendimento em ${region} às ${earliestTime}. Tem ${clientsToNotify} cliente${clientsToNotify !== 1 ? 's' : ''} desta região — quer agendar mais às ${slotsText}?`,
          freeSlots,
          clientsToNotify: Math.min(clientsToNotify, 3),
        });

        totalSavingsMinutes += Math.min(clientsToNotify, 2) * 20;
      }
    }

    // Format savings
    const potentialSavings =
      totalSavingsMinutes === 0
        ? '0 minutos'
        : totalSavingsMinutes < 60
          ? `${totalSavingsMinutes} minutos`
          : `${Math.floor(totalSavingsMinutes / 60)}h${totalSavingsMinutes % 60 > 0 ? ` ${totalSavingsMinutes % 60}min` : ''}`;

    return Response.json({
      date: targetDate,
      totalBookings: bookings.length,
      clusters: clusters.sort((a, b) => b.bookingCount - a.bookingCount),
      suggestions,
      potentialSavings,
    });
  } catch (error) {
    logger.error('Route optimization error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
