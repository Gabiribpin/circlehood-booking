import { createAdminClient } from '@/lib/supabase/admin';
import { getNextRetryAt } from '@/lib/webhooks/retry-backoff';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/admin/webhook-failures — List webhook failures
 * POST /api/admin/webhook-failures — Manual retry of a specific failure
 *
 * Protected by admin session cookie (validated in admin layout).
 */

export async function GET(request: NextRequest) {
  const { validateAdminToken } = await import('@/lib/admin/session');
  const adminSession = request.cookies.get('admin_session');
  if (!validateAdminToken(adminSession?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || 'all';
  const limit = Math.min(Number(searchParams.get('limit') || 50), 100);

  let query = supabase
    .from('webhook_failures')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also get counts per status
  const { data: allFailures } = await supabase
    .from('webhook_failures')
    .select('status');

  const counts = {
    pending: 0,
    retrying: 0,
    resolved: 0,
    dead_letter: 0,
    total: 0,
  };

  for (const f of allFailures ?? []) {
    counts.total++;
    const s = f.status as keyof typeof counts;
    if (s in counts) counts[s]++;
  }

  return NextResponse.json({ failures: data ?? [], counts });
}

export async function POST(request: NextRequest) {
  const { validateAdminToken } = await import('@/lib/admin/session');
  const adminSession = request.cookies.get('admin_session');
  if (!validateAdminToken(adminSession?.value)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const body = await request.json();
  const { failureId } = body;

  if (!failureId) {
    return NextResponse.json({ error: 'failureId required' }, { status: 400 });
  }

  // Reset the failure for retry: set status back to pending, schedule immediate retry
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('webhook_failures')
    .update({
      status: 'retrying',
      next_retry_at: now,
      updated_at: now,
    } as never)
    .eq('id', failureId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, failure: data });
}
