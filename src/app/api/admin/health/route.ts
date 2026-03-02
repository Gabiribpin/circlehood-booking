import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import Redis from 'ioredis';

const REDIS_URL = process.env.STORAGE_URL || process.env.REDIS_URL;

export async function GET(request: NextRequest) {
  // Admin auth: same cookie check as admin layout
  const cookieStore = await cookies();
  if (cookieStore.get('admin_session')?.value !== '1') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // 1. Recent webhook logs (last 20)
  const { data: recentWebhooks } = await supabase
    .from('webhook_logs')
    .select('id, created_at, instance_name, status, error, processing_time_ms, rate_limited')
    .order('created_at', { ascending: false })
    .limit(20);

  // 2. Success rate (last 24h)
  const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: last24h } = await supabase
    .from('webhook_logs')
    .select('status')
    .gte('created_at', cutoff24h);

  const total24h = last24h?.length ?? 0;
  const success24h = last24h?.filter((w) => w.status === 200).length ?? 0;
  const successRate = total24h > 0 ? success24h / total24h : 1;

  // 3. Redis status
  let redisStatus = 'not_configured';
  let activeLimits = 0;

  if (REDIS_URL) {
    let client: Redis | null = null;
    try {
      client = new Redis(REDIS_URL, {
        connectTimeout: 3000,
        commandTimeout: 3000,
        maxRetriesPerRequest: 0,
        lazyConnect: true,
      });
      await client.connect();
      await client.ping();
      redisStatus = 'ok';

      // Count active rate limit keys
      const keys = await client.keys('ratelimit:*');
      activeLimits = keys.length;
    } catch {
      redisStatus = 'error';
    } finally {
      if (client) client.disconnect();
    }
  }

  // 4. Active WhatsApp connections
  const { data: connections } = await supabase
    .from('whatsapp_config')
    .select('evolution_instance, bot_enabled, is_active')
    .eq('is_active', true);

  const totalConnections = connections?.length ?? 0;
  const botEnabledCount = connections?.filter((c) => c.bot_enabled !== false).length ?? 0;

  // 5. Average processing time from recent webhooks
  const avgProcessingMs =
    recentWebhooks && recentWebhooks.length > 0
      ? Math.round(
          recentWebhooks.reduce((sum, w) => sum + (w.processing_time_ms ?? 0), 0) /
            recentWebhooks.length
        )
      : 0;

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    redis: {
      status: redisStatus,
      active_limits: activeLimits,
    },
    webhooks: {
      recent: recentWebhooks ?? [],
      total_24h: total24h,
      success_rate_24h: successRate,
      avg_processing_ms: avgProcessingMs,
    },
    whatsapp: {
      total_connections: totalConnections,
      bot_enabled_count: botEnabledCount,
      connections: connections ?? [],
    },
  });
}
