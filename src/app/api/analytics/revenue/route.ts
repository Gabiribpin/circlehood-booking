import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
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
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'month';
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const granularity = searchParams.get('granularity') || 'day';

  if (!['day', 'week', 'month'].includes(granularity)) {
    return NextResponse.json({ error: 'Invalid granularity' }, { status: 400 });
  }

  const { start, end } = getDateRange(period, startDate, endDate);

  try {
    // Buscar agendamentos do período
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('booking_date, status, client_phone, service_id')
      .eq('professional_id', professional.id)
      .gte('booking_date', start)
      .lte('booking_date', end);

    if (bookingsError) throw bookingsError;

    const all = bookings ?? [];

    // Buscar preços dos serviços
    const serviceIds = [...new Set(all.map((b) => b.service_id).filter(Boolean))];
    const priceMap: Record<string, number> = {};

    if (serviceIds.length > 0) {
      const { data: services } = await supabase
        .from('services')
        .select('id, price')
        .in('id', serviceIds);
      for (const s of services ?? []) {
        priceMap[s.id] = Number(s.price ?? 0);
      }
    }

    // Agrupar por período (dia/semana/mês) em JS
    const groups = new Map<
      string,
      { revenue: number; bookings: number; cancelled: number; clients: Set<string> }
    >();

    for (const booking of all) {
      const key = getPeriodKey(booking.booking_date, granularity);
      if (!groups.has(key)) {
        groups.set(key, { revenue: 0, bookings: 0, cancelled: 0, clients: new Set() });
      }
      const g = groups.get(key)!;
      g.bookings++;
      if (booking.status === 'confirmed' || booking.status === 'completed') {
        g.revenue += priceMap[booking.service_id] ?? 0;
        if (booking.client_phone) g.clients.add(booking.client_phone);
      }
      if (booking.status === 'cancelled') g.cancelled++;
    }

    const data = Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, g]) => {
        const confirmedCount = g.bookings - g.cancelled;
        return {
          period,
          total_revenue: g.revenue,
          total_bookings: g.bookings,
          unique_clients: g.clients.size,
          avg_ticket: confirmedCount > 0 ? g.revenue / confirmedCount : 0,
          cancelled_rate: g.bookings > 0 ? (g.cancelled / g.bookings) * 100 : 0,
        };
      });

    return NextResponse.json({
      period: { startDate: start, endDate: end },
      granularity,
      data,
      computedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching revenue timeseries:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function getPeriodKey(date: string, granularity: string): string {
  if (granularity === 'day') return date;

  // Parsear sem conversão de timezone
  const [year, month, day] = date.split('-').map(Number);
  const d = new Date(year, month - 1, day);

  if (granularity === 'month') {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  if (granularity === 'week') {
    // ISO week number
    const tmp = new Date(d.getTime());
    tmp.setHours(0, 0, 0, 0);
    tmp.setDate(tmp.getDate() + 3 - ((tmp.getDay() + 6) % 7));
    const week1 = new Date(tmp.getFullYear(), 0, 4);
    const weekNum =
      1 +
      Math.round(
        ((tmp.getTime() - week1.getTime()) / 86400000 -
          3 +
          ((week1.getDay() + 6) % 7)) /
          7,
      );
    return `${tmp.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  }

  return date;
}

function getDateRange(period: string, startDate: string | null, endDate: string | null) {
  const now = new Date();
  let start: string, end: string;

  if (period === 'custom' && startDate && endDate) {
    start = startDate;
    end = endDate;
  } else {
    switch (period) {
      case 'day':
        start = end = now.toISOString().split('T')[0];
        break;
      case 'week':
        start = new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
        end = new Date().toISOString().split('T')[0];
        break;
      case 'year':
        start = new Date(now.setFullYear(now.getFullYear() - 1)).toISOString().split('T')[0];
        end = new Date().toISOString().split('T')[0];
        break;
      case 'month':
      default:
        start = new Date(now.setMonth(now.getMonth() - 1)).toISOString().split('T')[0];
        end = new Date().toISOString().split('T')[0];
    }
  }

  return { start, end };
}
