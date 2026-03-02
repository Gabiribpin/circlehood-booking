import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockGetStripe = vi.fn();
vi.mock('@/lib/stripe', () => ({
  getStripe: () => mockGetStripe(),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  })),
}));

import { POST } from '../route';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body = 'test-body', signature = 'test-sig') {
  return {
    text: () => Promise.resolve(body),
    headers: {
      get: (name: string) => (name === 'stripe-signature' ? signature : null),
    },
  } as any;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/stripe/webhook', () => {
  it('returns 400 when stripe-signature header is missing', async () => {
    const req = {
      text: () => Promise.resolve('body'),
      headers: { get: () => null },
    } as any;

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Missing signature');
  });

  it('returns 503 when Stripe is not configured (STRIPE_SECRET_KEY missing)', async () => {
    mockGetStripe.mockReturnValue(null);

    const res = await POST(makeRequest());
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toBe('Stripe not configured');
  });

  it('returns 503 when STRIPE_WEBHOOK_SECRET is not configured', async () => {
    const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET;

    mockGetStripe.mockReturnValue({
      webhooks: {
        constructEvent: vi.fn(),
      },
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toBe('Webhook secret not configured');

    // Restore
    if (originalSecret) process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
  });

  it('returns 400 when signature is invalid', async () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

    mockGetStripe.mockReturnValue({
      webhooks: {
        constructEvent: vi.fn().mockImplementation(() => {
          throw new Error('Invalid signature');
        }),
      },
    });

    const res = await POST(makeRequest());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Invalid signature');

    delete process.env.STRIPE_WEBHOOK_SECRET;
  });
});
