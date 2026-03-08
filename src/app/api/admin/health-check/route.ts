import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateAdminToken } from '@/lib/admin/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe';
import { evolutionConfig } from '@/lib/evolution/config';

const CONNECTIVITY_TIMEOUT = 5000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms),
  );
  return Promise.race([promise, timeout]);
}

interface ConnectivityResult {
  status: 'ok' | 'error' | 'skipped';
  latency_ms?: number;
  error?: string;
}

async function checkSupabase(): Promise<ConnectivityResult> {
  const start = Date.now();
  try {
    const supabase = createAdminClient();
    const result = await withTimeout(
      Promise.resolve(supabase.from('professionals').select('id').limit(1)),
      CONNECTIVITY_TIMEOUT,
    );
    if (result.error) return { status: 'error', latency_ms: Date.now() - start, error: result.error.message };
    return { status: 'ok', latency_ms: Date.now() - start };
  } catch (e: any) {
    return { status: 'error', latency_ms: Date.now() - start, error: e.message };
  }
}

async function checkRedis(): Promise<ConnectivityResult> {
  const redisUrl = process.env.STORAGE_URL || process.env.REDIS_URL;
  if (!redisUrl) return { status: 'skipped', error: 'Not configured' };
  const start = Date.now();
  try {
    const { default: Redis } = await import('ioredis');
    const { parseRedisUrl } = await import('@/lib/redis/parse-url');
    const redis = new Redis({
      ...parseRedisUrl(redisUrl),
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      commandTimeout: 3000,
      lazyConnect: true,
    });
    await withTimeout(redis.ping(), CONNECTIVITY_TIMEOUT);
    await redis.quit();
    return { status: 'ok', latency_ms: Date.now() - start };
  } catch (e: any) {
    return { status: 'error', latency_ms: Date.now() - start, error: e.message };
  }
}

async function checkEvolutionApi(): Promise<ConnectivityResult> {
  const { baseUrl, globalApiKey } = evolutionConfig;
  if (!baseUrl || !globalApiKey) return { status: 'skipped', error: 'Not configured' };
  const instance = process.env.EVOLUTION_INSTANCE_SALES ?? 'circlehood-sales';
  const start = Date.now();
  try {
    const res = await withTimeout(
      fetch(`${baseUrl}/instance/connectionState/${instance}`, {
        headers: { apikey: globalApiKey },
      }),
      CONNECTIVITY_TIMEOUT,
    );
    if (!res.ok) return { status: 'error', latency_ms: Date.now() - start, error: `HTTP ${res.status}` };
    return { status: 'ok', latency_ms: Date.now() - start };
  } catch (e: any) {
    return { status: 'error', latency_ms: Date.now() - start, error: e.message };
  }
}

async function checkStripe(): Promise<ConnectivityResult> {
  const stripe = getStripe();
  if (!stripe) return { status: 'skipped', error: 'Not configured' };
  const start = Date.now();
  try {
    await withTimeout(stripe.balance.retrieve(), CONNECTIVITY_TIMEOUT);
    return { status: 'ok', latency_ms: Date.now() - start };
  } catch (e: any) {
    return { status: 'error', latency_ms: Date.now() - start, error: e.message };
  }
}

/**
 * GET /api/admin/health-check — Admin-authenticated health check.
 * Used by the admin status dashboard to run connectivity checks.
 */
export async function GET() {
  const cookieStore = await cookies();
  if (!(await validateAdminToken(cookieStore.get('admin_session')?.value))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [supabase, redis, evolutionApi, stripe] = await Promise.all([
    checkSupabase(),
    checkRedis(),
    checkEvolutionApi(),
    checkStripe(),
  ]);

  const connectivity = { supabase, redis, evolution_api: evolutionApi, stripe };

  const connectivityFailures = Object.entries(connectivity)
    .filter(([, v]) => v.status === 'error')
    .map(([k]) => k);

  const status = connectivityFailures.length === 0 ? 'healthy' : 'degraded';

  return NextResponse.json({
    status,
    connectivity,
    connectivity_failures: connectivityFailures,
    critical_missing: [] as string[],
    timestamp: new Date().toISOString(),
  });
}
