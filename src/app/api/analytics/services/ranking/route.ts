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
  const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);

  const { start, end } = getDateRange(period, startDate, endDate);

  try {
    // Agendamentos confirmados com dados do serviço via JOIN (single query)
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('service_id, services(id, name, price)')
      .eq('professional_id', professional.id)
      .gte('booking_date', start)
      .lte('booking_date', end)
      .in('status', ['confirmed', 'completed']);

    if (bookingsError) throw bookingsError;

    // Contar agendamentos por serviço e coletar info
    const serviceMap = new Map<string, { name: string; price: number; count: number }>();
    for (const b of bookings ?? []) {
      const svc = b.services as unknown as { id: string; name: string; price: number } | null;
      if (!b.service_id || !svc) continue;
      const existing = serviceMap.get(b.service_id);
      if (existing) {
        existing.count++;
      } else {
        serviceMap.set(b.service_id, { name: svc.name, price: Number(svc.price), count: 1 });
      }
    }

    const days = Math.max(
      1,
      Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000),
    );

    const ranking = Array.from(serviceMap.entries())
      .map(([id, s]) => ({
        service_id: id,
        service_name: s.name,
        service_price: s.price,
        total_bookings: s.count,
        total_revenue: s.count * s.price,
        avg_bookings_per_day: s.count / days,
      }))
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, limit);

    return NextResponse.json({
      period: { startDate: start, endDate: end },
      services: ranking,
      computedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching services ranking:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
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
