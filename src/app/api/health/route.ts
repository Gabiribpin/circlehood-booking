import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe';
import { evolutionConfig } from '@/lib/evolution/config';

const CONNECTIVITY_TIMEOUT = 5000;

type ServiceStatus = 'ok' | 'error' | 'skipped';

interface ConnectivityResult {
  status: ServiceStatus;
  latency_ms?: number;
  error?: string;
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms),
  );
  return Promise.race([promise, timeout]);
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
  if (!redisUrl) return { status: 'skipped', error: 'No REDIS_URL configured' };

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
  if (!baseUrl || !globalApiKey) return { status: 'skipped', error: 'Evolution API not configured' };

  const instance = process.env.EVOLUTION_INSTANCE_SALES ?? 'circlehood-sales';
  const start = Date.now();
  try {
    const res = await withTimeout(
      fetch(`${baseUrl}/instance/connectionState/${instance}`, {
        headers: { apikey: globalApiKey },
      }),
      CONNECTIVITY_TIMEOUT,
    );
    if (!res.ok) {
      return { status: 'error', latency_ms: Date.now() - start, error: `HTTP ${res.status}` };
    }
    return { status: 'ok', latency_ms: Date.now() - start };
  } catch (e: any) {
    return { status: 'error', latency_ms: Date.now() - start, error: e.message };
  }
}

async function checkStripe(): Promise<ConnectivityResult> {
  const stripe = getStripe();
  if (!stripe) return { status: 'skipped', error: 'Stripe not configured' };

  const start = Date.now();
  try {
    await withTimeout(stripe.balance.retrieve(), CONNECTIVITY_TIMEOUT);
    return { status: 'ok', latency_ms: Date.now() - start };
  } catch (e: any) {
    return { status: 'error', latency_ms: Date.now() - start, error: e.message };
  }
}

/**
 * GET /api/health — verifica env vars críticas e conectividade real.
 *
 * Protegido por CRON_SECRET (mesmo padrão dos crons).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const checks = {
    supabase: {
      url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      anon_key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      service_role_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    stripe: {
      secret_key: !!process.env.STRIPE_SECRET_KEY,
      publishable_key: !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      webhook_secret: !!process.env.STRIPE_WEBHOOK_SECRET,
      deposit_webhook_secret: !!process.env.STRIPE_DEPOSIT_WEBHOOK_SECRET,
      connect_webhook_secret: !!process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
      price_id: !!process.env.STRIPE_PRICE_ID,
    },
    resend: {
      api_key: !!process.env.RESEND_API_KEY,
      from_email: process.env.RESEND_FROM_EMAIL || (
        process.env.NODE_ENV === 'production'
          ? 'noreply@circlehood-tech.com (hardcoded)'
          : 'onboarding@resend.dev (dev fallback)'
      ),
    },
    anthropic: {
      api_key: !!process.env.ANTHROPIC_API_KEY,
    },
    redis: {
      url: !!(process.env.STORAGE_URL || process.env.REDIS_URL),
    },
    environment: {
      vercel_env: process.env.VERCEL_ENV || 'not set',
      node_env: process.env.NODE_ENV || 'not set',
    },
  };

  // Connectivity checks (run in parallel)
  const [supabase, redis, evolutionApi, stripe] = await Promise.all([
    checkSupabase(),
    checkRedis(),
    checkEvolutionApi(),
    checkStripe(),
  ]);

  const connectivity = { supabase, redis, evolution_api: evolutionApi, stripe };

  // Calcular status geral
  const criticalMissing: string[] = [];

  if (!checks.supabase.url || !checks.supabase.service_role_key) {
    criticalMissing.push('supabase');
  }
  if (!checks.stripe.secret_key) {
    criticalMissing.push('stripe.secret_key');
  }
  if (!checks.stripe.webhook_secret) {
    criticalMissing.push('stripe.webhook_secret');
  }
  if (!checks.stripe.deposit_webhook_secret) {
    criticalMissing.push('stripe.deposit_webhook_secret');
  }
  if (!checks.stripe.connect_webhook_secret) {
    criticalMissing.push('stripe.connect_webhook_secret');
  }
  if (!checks.resend.api_key) {
    criticalMissing.push('resend.api_key');
  }

  // Check connectivity failures
  const connectivityFailures = Object.entries(connectivity)
    .filter(([, v]) => v.status === 'error')
    .map(([k]) => k);

  const status = criticalMissing.length === 0 && connectivityFailures.length === 0
    ? 'healthy'
    : 'degraded';

  return NextResponse.json({
    status,
    critical_missing: criticalMissing,
    connectivity_failures: connectivityFailures,
    checks,
    connectivity,
    timestamp: new Date().toISOString(),
  }, { status: status === 'healthy' ? 200 : 503 });
}
