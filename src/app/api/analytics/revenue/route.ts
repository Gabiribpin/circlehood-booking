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
  const granularity = searchParams.get('granularity') || 'day';

  // Validate granularity
  if (!['day', 'week', 'month'].includes(granularity)) {
    return NextResponse.json({ error: 'Invalid granularity' }, { status: 400 });
  }

  // Calculate date range
  const { start, end } = getDateRange(period, startDate, endDate);

  try {
    // Check cache first
    const cacheKey = `revenue_${period}_${granularity}_${start}_${end}`;
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

    // Call PostgreSQL function for time series
    const { data: timeseries, error } = await supabase.rpc('get_revenue_timeseries', {
      p_professional_id: professional.id,
      p_start_date: start,
      p_end_date: end,
      p_granularity: granularity,
    });

    if (error) throw error;

    const result = {
      period: { startDate: start, endDate: end },
      granularity,
      data: timeseries || [],
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
        data: result,
        expires_at: expiresAt,
      },
      {
        onConflict: 'professional_id,metric_key,period_start,period_end',
      }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching revenue timeseries:', error);
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
