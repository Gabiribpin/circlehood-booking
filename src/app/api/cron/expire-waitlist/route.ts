import { logger } from '@/lib/logger';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // Verificar autorização do cron
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
    // Expirar waitlist não respondidos (após 24h da notificação)
    const { error: expireError } = await supabase.rpc('expire_unresponsive_waitlist');

    if (expireError) {
      throw new Error(`Error expiring waitlist: ${expireError.message}`);
    }

    // Contar quantos foram expirados
    const { data: expiredCount } = await supabase.rpc('expire_unresponsive_waitlist');

    // Log sucesso
    await supabase.from('cron_logs').insert({
      job_name: 'expire-waitlist',
      status: 'success',
      records_processed: expiredCount || 0,
      execution_time_ms: Date.now() - startTime,
      metadata: {
        waitlist_expired: expiredCount || 0,
        expired_at: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      waitlistExpired: expiredCount || 0,
      execution_time_ms: Date.now() - startTime,
    });
  } catch (error: any) {
    logger.error('Error in expire-waitlist cron:', error);

    // Log erro
    await supabase.from('cron_logs').insert({
      job_name: 'expire-waitlist',
      status: 'error',
      error_message: error.message,
      execution_time_ms: Date.now() - startTime,
    });

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
