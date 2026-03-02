import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/health — verifica env vars críticas sem expor secrets.
 *
 * Protegido por CRON_SECRET (mesmo padrão dos crons).
 * Retorna status por serviço: ok | missing | partial.
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

  const status = criticalMissing.length === 0 ? 'healthy' : 'degraded';

  return NextResponse.json({
    status,
    critical_missing: criticalMissing,
    checks,
    timestamp: new Date().toISOString(),
  }, { status: status === 'healthy' ? 200 : 503 });
}
