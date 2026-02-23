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
    // Agendamentos confirmados no período
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('service_id')
      .eq('professional_id', professional.id)
      .gte('booking_date', start)
      .lte('booking_date', end)
      .in('status', ['confirmed', 'completed']);

    if (bookingsError) throw bookingsError;

    // Serviços ativos do profissional
    const { data: services, error: servicesError } = await supabase
      .from('services')
      .select('id, name, price')
      .eq('professional_id', professional.id)
      .eq('is_active', true);

    if (servicesError) throw servicesError;

    // Contar agendamentos por serviço
    const counts: Record<string, number> = {};
    for (const b of bookings ?? []) {
      if (b.service_id) counts[b.service_id] = (counts[b.service_id] ?? 0) + 1;
    }

    const days = Math.max(
      1,
      Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000),
    );

    const ranking = (services ?? [])
      .filter((s) => counts[s.id] > 0)
      .map((s) => ({
        service_id: s.id,
        service_name: s.name,
        service_price: Number(s.price),
        total_bookings: counts[s.id],
        total_revenue: counts[s.id] * Number(s.price),
        avg_bookings_per_day: counts[s.id] / days,
      }))
      .sort((a, b) => b.total_revenue - a.total_revenue)
      .slice(0, limit);

    return NextResponse.json({
      period: { startDate: start, endDate: end },
      services: ranking,
      computedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching services ranking:', error);
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
