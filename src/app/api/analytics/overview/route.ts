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

  const { start, end } = getDateRange(period, startDate, endDate);

  try {
    // Buscar todos os agendamentos do período com o service_id
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id, status, client_phone, service_id')
      .eq('professional_id', professional.id)
      .gte('booking_date', start)
      .lte('booking_date', end);

    if (bookingsError) throw bookingsError;

    const all = bookings ?? [];

    // Buscar preços dos serviços utilizados
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

    const confirmed = all.filter((b) => b.status === 'confirmed' || b.status === 'completed');
    const cancelled = all.filter((b) => b.status === 'cancelled');

    const totalRevenue = confirmed.reduce((sum, b) => sum + (priceMap[b.service_id] ?? 0), 0);
    const confirmedCount = confirmed.length;
    const uniqueClients = new Set(confirmed.map((b) => b.client_phone).filter(Boolean)).size;
    const averageTicket = confirmedCount > 0 ? totalRevenue / confirmedCount : 0;
    const cancelledRate = all.length > 0 ? (cancelled.length / all.length) * 100 : 0;

    return NextResponse.json({
      period: { startDate: start, endDate: end },
      totalRevenue,
      totalBookings: all.length,
      confirmedBookings: confirmedCount,
      cancelledBookings: cancelled.length,
      uniqueClients,
      averageTicket,
      cancelledRate,
      computedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching analytics overview:', error);
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
