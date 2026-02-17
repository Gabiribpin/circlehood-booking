import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get professional_id
  const { data: professional } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!professional) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Parse query params
  const { searchParams } = new URL(request.url);
  const period = searchParams.get('period') || 'month';
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  // Calculate date range
  const { start, end } = getDateRange(period, startDate, endDate);

  try {
    // Check cache first
    const cacheKey = `overview_${period}_${start}_${end}`;
    const { data: cachedData } = await supabase
      .from('analytics_cache')
      .select('data')
      .eq('professional_id', professional.id)
      .eq('metric_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (cachedData?.data) {
      return NextResponse.json(cachedData.data);
    }

    // Query from materialized view
    const { data: metrics, error } = await supabase
      .from('daily_metrics')
      .select('*')
      .eq('professional_id', professional.id)
      .gte('booking_date', start)
      .lte('booking_date', end);

    if (error) throw error;

    // Aggregate results
    const overview = {
      period: { startDate: start, endDate: end },
      totalRevenue: metrics?.reduce((sum, m) => sum + Number(m.total_revenue || 0), 0) || 0,
      totalBookings: metrics?.reduce((sum, m) => sum + Number(m.total_bookings || 0), 0) || 0,
      confirmedBookings: metrics?.reduce((sum, m) => sum + Number(m.confirmed_bookings || 0), 0) || 0,
      cancelledBookings: metrics?.reduce((sum, m) => sum + Number(m.cancelled_bookings || 0), 0) || 0,
      uniqueClients: metrics?.reduce((sum, m) => sum + Number(m.unique_clients || 0), 0) || 0,
      averageTicket:
        metrics && metrics.length > 0
          ? metrics.reduce((sum, m) => sum + Number(m.avg_ticket || 0), 0) / metrics.length
          : 0,
      cancelledRate:
        metrics && metrics.reduce((sum, m) => sum + Number(m.total_bookings || 0), 0) > 0
          ? (metrics.reduce((sum, m) => sum + Number(m.cancelled_bookings || 0), 0) /
              metrics.reduce((sum, m) => sum + Number(m.total_bookings || 0), 0)) *
            100
          : 0,
      qrScanBookings: metrics?.reduce((sum, m) => sum + Number(m.from_qr_scan || 0), 0) || 0,
      computedAt: new Date().toISOString(),
    };

    // Cache for 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await supabase.from('analytics_cache').upsert(
      {
        professional_id: professional.id,
        metric_key: cacheKey,
        period_start: start,
        period_end: end,
        data: overview,
        expires_at: expiresAt,
      },
      {
        onConflict: 'professional_id,metric_key,period_start,period_end',
      }
    );

    return NextResponse.json(overview);
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
