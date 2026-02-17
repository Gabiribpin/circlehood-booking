import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Verificar autorização do cron
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = await createClient();

  try {
    // Refresh materialized view de analytics
    const { error: refreshError } = await supabase.rpc('refresh_daily_metrics');

    if (refreshError) {
      throw new Error(`Error refreshing analytics: ${refreshError.message}`);
    }

    // Log sucesso
    await supabase.from('cron_logs').insert({
      job_name: 'refresh-analytics',
      status: 'success',
      records_processed: 1,
      execution_time_ms: Date.now() - startTime,
      metadata: { refreshed_at: new Date().toISOString() },
    });

    return NextResponse.json({
      success: true,
      message: 'Analytics refreshed successfully',
      execution_time_ms: Date.now() - startTime,
    });
  } catch (error: any) {
    console.error('Error in refresh-analytics cron:', error);

    // Log erro
    await supabase.from('cron_logs').insert({
      job_name: 'refresh-analytics',
      status: 'error',
      error_message: error.message,
      execution_time_ms: Date.now() - startTime,
    });

    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
