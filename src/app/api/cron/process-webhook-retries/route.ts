import { logger } from '@/lib/logger';
import { createClient } from '@supabase/supabase-js';
import { processWebhookRetries } from '@/lib/webhooks/retry-queue';
import { NextRequest, NextResponse } from 'next/server';

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
    const result = await processWebhookRetries(supabase);

    logger.info(`[process-webhook-retries] Processed ${result.processed}: ${result.succeeded} succeeded, ${result.failed} failed, ${result.deadLettered} dead-lettered`);

    try {
      await supabase.from('cron_logs').insert({
        job_name: 'process-webhook-retries',
        status: 'success',
        records_processed: result.processed,
        execution_time_ms: Date.now() - startTime,
        metadata: result,
      } as never);
    } catch { /* non-fatal */ }

    return NextResponse.json({
      success: true,
      ...result,
      execution_time_ms: Date.now() - startTime,
    });
  } catch (error: any) {
    logger.error('[process-webhook-retries] Error:', error);

    try {
      await supabase.from('cron_logs').insert({
        job_name: 'process-webhook-retries',
        status: 'error',
        error_message: error.message,
        execution_time_ms: Date.now() - startTime,
      } as never);
    } catch { /* non-fatal */ }

    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
