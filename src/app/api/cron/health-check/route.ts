import { NextRequest, NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/cron-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe';
import { evolutionConfig } from '@/lib/evolution/config';
import { Resend } from 'resend';
import { logger } from '@/lib/logger';

const CONNECTIVITY_TIMEOUT = 5000;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms),
  );
  return Promise.race([promise, timeout]);
}

interface CheckResult {
  service: string;
  status: 'ok' | 'error' | 'skipped';
  latency_ms?: number;
  error?: string;
}

async function checkSupabase(): Promise<CheckResult> {
  const start = Date.now();
  try {
    const supabase = createAdminClient();
    const result = await withTimeout(
      Promise.resolve(supabase.from('professionals').select('id').limit(1)),
      CONNECTIVITY_TIMEOUT,
    );
    if (result.error) return { service: 'supabase', status: 'error', latency_ms: Date.now() - start, error: result.error.message };
    return { service: 'supabase', status: 'ok', latency_ms: Date.now() - start };
  } catch (e: any) {
    return { service: 'supabase', status: 'error', latency_ms: Date.now() - start, error: e.message };
  }
}

async function checkRedis(): Promise<CheckResult> {
  const redisUrl = process.env.STORAGE_URL || process.env.REDIS_URL;
  if (!redisUrl) return { service: 'redis', status: 'skipped', error: 'Not configured' };

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
    return { service: 'redis', status: 'ok', latency_ms: Date.now() - start };
  } catch (e: any) {
    return { service: 'redis', status: 'error', latency_ms: Date.now() - start, error: e.message };
  }
}

async function checkEvolutionApi(): Promise<CheckResult> {
  const { baseUrl, globalApiKey } = evolutionConfig;
  if (!baseUrl || !globalApiKey) return { service: 'evolution_api', status: 'skipped', error: 'Not configured' };

  const instance = process.env.EVOLUTION_INSTANCE_SALES ?? 'circlehood-sales';
  const start = Date.now();
  try {
    const res = await withTimeout(
      fetch(`${baseUrl}/instance/connectionState/${instance}`, {
        headers: { apikey: globalApiKey },
      }),
      CONNECTIVITY_TIMEOUT,
    );
    if (!res.ok) return { service: 'evolution_api', status: 'error', latency_ms: Date.now() - start, error: `HTTP ${res.status}` };
    return { service: 'evolution_api', status: 'ok', latency_ms: Date.now() - start };
  } catch (e: any) {
    return { service: 'evolution_api', status: 'error', latency_ms: Date.now() - start, error: e.message };
  }
}

async function checkStripe(): Promise<CheckResult> {
  const stripe = getStripe();
  if (!stripe) return { service: 'stripe', status: 'skipped', error: 'Not configured' };

  const start = Date.now();
  try {
    await withTimeout(stripe.balance.retrieve(), CONNECTIVITY_TIMEOUT);
    return { service: 'stripe', status: 'ok', latency_ms: Date.now() - start };
  } catch (e: any) {
    return { service: 'stripe', status: 'error', latency_ms: Date.now() - start, error: e.message };
  }
}

function getFromEmail() {
  if (process.env.RESEND_FROM_EMAIL) return process.env.RESEND_FROM_EMAIL;
  return process.env.NODE_ENV === 'production'
    ? 'noreply@circlehood-tech.com'
    : 'onboarding@resend.dev';
}

/**
 * GET /api/cron/health-check — Cron diário (6h UTC).
 * Verifica conectividade dos serviços críticos.
 * Se houver falhas, envia alerta por email ao ADMIN_EMAIL.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  const results = await Promise.all([
    checkSupabase(),
    checkRedis(),
    checkEvolutionApi(),
    checkStripe(),
  ]);

  const failures = results.filter((r) => r.status === 'error');
  const hasFailures = failures.length > 0;

  // Send alert email if any critical service is down
  if (hasFailures && process.env.ADMIN_EMAIL && process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const failureList = failures
        .map((f) => `• ${f.service}: ${f.error} (${f.latency_ms}ms)`)
        .join('\n');

      await resend.emails.send({
        from: `CircleHood Alertas <${getFromEmail()}>`,
        to: process.env.ADMIN_EMAIL,
        subject: `[ALERTA] ${failures.length} serviço(s) com falha — Health Check`,
        html: `
          <h2>Health Check — Serviços com Falha</h2>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <pre>${failureList}</pre>
          <h3>Todos os resultados:</h3>
          <pre>${JSON.stringify(results, null, 2)}</pre>
        `,
      });
    } catch (emailError: any) {
      logger.error('[health-check] Failed to send alert email:', emailError.message);
    }
  }

  // Log to cron_logs
  const supabase = createAdminClient();
  await supabase.from('cron_logs').insert({
    job_name: 'health-check',
    status: hasFailures ? 'error' : 'success',
    records_processed: results.length,
    records_failed: failures.length,
    execution_time_ms: Date.now() - startTime,
    metadata: {
      results,
      alert_sent: hasFailures && !!process.env.ADMIN_EMAIL,
    },
  } as never);

  return NextResponse.json({
    status: hasFailures ? 'degraded' : 'healthy',
    results,
    execution_time_ms: Date.now() - startTime,
    alert_sent: hasFailures && !!process.env.ADMIN_EMAIL,
  }, { status: hasFailures ? 503 : 200 });
}
