import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const professionalId = searchParams.get('professional_id');
  const serviceId = searchParams.get('service_id');
  const date = searchParams.get('date'); // YYYY-MM-DD

  if (!professionalId || !serviceId || !date) {
    return NextResponse.json(
      { error: 'Missing required parameters' },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // 1. Get service duration
  const { data: service } = await supabase
    .from('services')
    .select('duration_minutes')
    .eq('id', serviceId)
    .single();

  if (!service) {
    return NextResponse.json({ error: 'Service not found' }, { status: 404 });
  }

  // 2. Check if date is blocked
  const { data: blocked } = await supabase
    .from('blocked_dates')
    .select('id')
    .eq('professional_id', professionalId)
    .eq('blocked_date', date)
    .limit(1);

  if (blocked && blocked.length > 0) {
    return NextResponse.json({ slots: [] });
  }

  // 3. Get working hours for the day of week
  const dayOfWeek = new Date(date + 'T12:00:00').getDay(); // 0=Sunday
  const { data: workingHours } = await supabase
    .from('working_hours')
    .select('*')
    .eq('professional_id', professionalId)
    .eq('day_of_week', dayOfWeek)
    .eq('is_available', true)
    .single();

  if (!workingHours) {
    return NextResponse.json({ slots: [] });
  }

  // 4. Get confirmed bookings for the date
  const { data: bookings } = await supabase
    .from('bookings')
    .select('start_time, end_time')
    .eq('professional_id', professionalId)
    .eq('booking_date', date)
    .eq('status', 'confirmed');

  // 5. Generate slots every 30 minutes
  const startMinutes = timeToMinutes(workingHours.start_time);
  const endMinutes = timeToMinutes(workingHours.end_time);
  const duration = service.duration_minutes;
  const slots: string[] = [];

  for (let m = startMinutes; m + duration <= endMinutes; m += 30) {
    const slotStart = m;
    const slotEnd = m + duration;

    // 6. Check collision with existing bookings
    const hasConflict = (bookings || []).some((b) => {
      const bStart = timeToMinutes(b.start_time);
      const bEnd = timeToMinutes(b.end_time);
      return slotStart < bEnd && slotEnd > bStart;
    });

    if (!hasConflict) {
      slots.push(minutesToTime(slotStart));
    }
  }

  // 7. If today, remove past slots
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const filteredSlots =
    date === todayStr
      ? slots.filter((s) => {
          const slotMinutes = timeToMinutes(s);
          const currentMinutes = now.getHours() * 60 + now.getMinutes();
          return slotMinutes > currentMinutes;
        })
      : slots;

  return NextResponse.json({ slots: filteredSlots });
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}
