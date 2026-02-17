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
    // Cleanup tokens expirados
    const { error: cleanupError } = await supabase.rpc('cleanup_expired_tokens');

    if (cleanupError) {
      throw new Error(`Error cleaning up tokens: ${cleanupError.message}`);
    }

    // Contar quantos foram deletados (via função)
    const { data: deletedCount } = await supabase.rpc('cleanup_expired_tokens');

    // Log sucesso
    await supabase.from('cron_logs').insert({
      job_name: 'cleanup-tokens',
      status: 'success',
      records_processed: deletedCount || 0,
      execution_time_ms: Date.now() - startTime,
      metadata: {
        tokens_deleted: deletedCount || 0,
        cleaned_at: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      tokensDeleted: deletedCount || 0,
      execution_time_ms: Date.now() - startTime,
    });
  } catch (error: any) {
    console.error('Error in cleanup-tokens cron:', error);

    // Log erro
    await supabase.from('cron_logs').insert({
      job_name: 'cleanup-tokens',
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
