import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock connectivity dependencies before importing route
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        limit: () => Promise.resolve({ data: [{ id: '1' }], error: null }),
      }),
    }),
  }),
}));

vi.mock('@/lib/stripe', () => ({
  getStripe: () => null, // skipped when not configured
}));

vi.mock('@/lib/evolution/config', () => ({
  evolutionConfig: { baseUrl: '', globalApiKey: '' },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CRON_SECRET = 'test-health-secret';

function makeRequest(authHeader?: string) {
  return {
    headers: {
      get: (name: string) =>
        name === 'authorization' ? authHeader ?? null : null,
    },
  } as any;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /api/health', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.CRON_SECRET = CRON_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // Must import after mocks are set up
  async function getHandler() {
    const { GET } = await import('../route');
    return GET;
  }

  it('returns 401 without authorization header', async () => {
    const GET = await getHandler();
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong secret', async () => {
    const GET = await getHandler();
    const res = await GET(makeRequest('Bearer wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('returns 503 (degraded) when critical env vars are missing', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.RESEND_API_KEY;

    const GET = await getHandler();
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(503);

    const data = await res.json();
    expect(data.status).toBe('degraded');
    expect(data.critical_missing).toContain('stripe.secret_key');
    expect(data.critical_missing).toContain('stripe.webhook_secret');
    expect(data.critical_missing).toContain('resend.api_key');
    expect(data.checks).toBeDefined();
    expect(data.connectivity).toBeDefined();
    expect(data.timestamp).toBeDefined();
  });

  it('returns 200 (healthy) when all critical env vars are present', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_123';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    process.env.STRIPE_DEPOSIT_WEBHOOK_SECRET = 'whsec_deposit';
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET = 'whsec_connect';
    process.env.STRIPE_PRICE_ID = 'price_test';
    process.env.RESEND_API_KEY = 're_test_123';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test';

    const GET = await getHandler();
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe('healthy');
    expect(data.critical_missing).toHaveLength(0);
    expect(data.connectivity_failures).toHaveLength(0);
    expect(data.checks.stripe.secret_key).toBe(true);
    expect(data.checks.resend.api_key).toBe(true);
    expect(data.checks.supabase.url).toBe(true);
    // Connectivity results present
    expect(data.connectivity.supabase.status).toBe('ok');
    expect(data.connectivity.stripe.status).toBe('skipped'); // no real Stripe key
    expect(data.connectivity.evolution_api.status).toBe('skipped');
  });

  it('does not expose secret values in response', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_live_super_secret';
    process.env.RESEND_API_KEY = 're_super_secret';

    const GET = await getHandler();
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`));
    const text = JSON.stringify(await res.json());

    expect(text).not.toContain('sk_live_super_secret');
    expect(text).not.toContain('re_super_secret');
    expect(text).toContain('"secret_key":true');
    expect(text).toContain('"api_key":true');
  });
});
