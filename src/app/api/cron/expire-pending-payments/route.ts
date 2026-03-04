import { logger } from '@/lib/logger';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const EXPIRATION_MINUTES = 30;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const cutoff = new Date(Date.now() - EXPIRATION_MINUTES * 60 * 1000).toISOString();

    const { data: expired, error: updateError } = await supabase
      .from('bookings')
      .update({ status: 'expired' })
      .eq('status', 'pending_payment')
      .lt('created_at', cutoff)
      .select('id');

    if (updateError) {
      throw new Error(`Error expiring pending payments: ${updateError.message}`);
    }

    const count = expired?.length ?? 0;

    logger.info(`[expire-pending-payments] Expired ${count} bookings older than ${EXPIRATION_MINUTES}min`);

    try {
      await supabase.from('cron_logs').insert({
        job_name: 'expire-pending-payments',
        status: 'success',
        records_processed: count,
        execution_time_ms: Date.now() - startTime,
        metadata: {
          cutoff,
          expired_ids: (expired ?? []).map((b) => b.id),
        },
      } as never);
    } catch { /* non-fatal */ }

    return NextResponse.json({
      success: true,
      expired: count,
      execution_time_ms: Date.now() - startTime,
    });
  } catch (error: any) {
    logger.error('[expire-pending-payments] Error:', error);

    try {
      await supabase.from('cron_logs').insert({
        job_name: 'expire-pending-payments',
        status: 'error',
        error_message: error.message,
        execution_time_ms: Date.now() - startTime,
      } as never);
    } catch { /* non-fatal */ }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
