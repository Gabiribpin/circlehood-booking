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
  const clientType = searchParams.get('type'); // 'new', 'occasional', 'recurring'
  const engagementStatus = searchParams.get('status'); // 'active', 'at_risk', 'churned'
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  try {
    // Build query from client_classification view
    let query = supabase
      .from('client_classification')
      .select('*')
      .eq('professional_id', professional.id);

    // Apply filters
    if (clientType) {
      query = query.eq('client_type', clientType);
    }
    if (engagementStatus) {
      query = query.eq('engagement_status', engagementStatus);
    }

    // Apply pagination and ordering
    query = query
      .order('lifetime_value', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: clients, error, count } = await query;

    if (error) throw error;

    // Get summary statistics
    const { data: summary } = await supabase
      .from('client_classification')
      .select('client_type, engagement_status')
      .eq('professional_id', professional.id);

    const stats = {
      total: summary?.length || 0,
      byType: {
        new: summary?.filter((c) => c.client_type === 'new').length || 0,
        occasional: summary?.filter((c) => c.client_type === 'occasional').length || 0,
        recurring: summary?.filter((c) => c.client_type === 'recurring').length || 0,
      },
      byEngagement: {
        active: summary?.filter((c) => c.engagement_status === 'active').length || 0,
        at_risk: summary?.filter((c) => c.engagement_status === 'at_risk').length || 0,
        churned: summary?.filter((c) => c.engagement_status === 'churned').length || 0,
      },
    };

    return NextResponse.json({
      clients: clients || [],
      stats,
      pagination: {
        limit,
        offset,
        total: count || clients?.length || 0,
      },
      computedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching client analytics:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
