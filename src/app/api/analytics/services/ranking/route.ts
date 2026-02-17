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
  const limit = parseInt(searchParams.get('limit') || '10', 10);

  // Calculate date range
  const { start, end } = getDateRange(period, startDate, endDate);

  try {
    // Check cache first
    const cacheKey = `services_ranking_${period}_${limit}_${start}_${end}`;
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

    // Call PostgreSQL function for services ranking
    const { data: ranking, error } = await supabase.rpc('get_services_ranking', {
      p_professional_id: professional.id,
      p_start_date: start,
      p_end_date: end,
      p_limit: limit,
    });

    if (error) throw error;

    const result = {
      period: { startDate: start, endDate: end },
      services: ranking || [],
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
