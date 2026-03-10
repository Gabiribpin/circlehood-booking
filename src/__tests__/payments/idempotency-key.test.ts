import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockStripePaymentIntentsCreate = vi.fn();
const mockStripeCheckoutSessionsCreate = vi.fn();

vi.mock('@/lib/stripe/server', () => ({
  getStripeServer: vi.fn(() => ({
    paymentIntents: { create: mockStripePaymentIntentsCreate },
    checkout: { sessions: { create: mockStripeCheckoutSessionsCreate } },
    accounts: { retrieve: vi.fn().mockResolvedValue({ charges_enabled: true, payouts_enabled: true }) },
  })),
}));

const mockFrom = vi.fn();
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock('@/lib/payment/calculate-deposit', () => ({
  calculateDeposit: vi.fn(() => 30),
  toCents: vi.fn((v: number) => v * 100),
}));

vi.mock('@/lib/validation/booking-schema', () => ({
  bookingSchema: {
    safeParse: vi.fn((data: Record<string, unknown>) => ({
      success: true,
      data: {
        professional_id: data.professional_id,
        service_id: data.service_id,
        booking_date: data.booking_date || '2026-03-10',
        start_time: data.start_time || '10:00',
        client_name: data.client_name || 'Test',
        client_phone: data.client_phone || '353800000001',
      },
    })),
  },
  sanitizeString: vi.fn((s: string) => s),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mockSupabase(overrides: Record<string, unknown> = {}) {
  const professional = {
    id: '00000000-0000-4000-a000-000000000001',
    require_deposit: true,
    deposit_type: 'percentage',
    deposit_value: 30,
    currency: 'EUR',
    subscription_status: 'active',
    trial_ends_at: '2027-01-01',
    stripe_account_id: 'acct_test',
    ...overrides,
  };
  const service = { id: '00000000-0000-4000-a000-000000000002', name: 'Corte', price: 100, duration_minutes: 30 };
  const booking = { id: 'booking-123' };
  const connectAccount = { charges_enabled: true };

  mockFrom.mockImplementation((table: string) => {
    if (table === 'professionals') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: professional, error: null }),
          }),
        }),
      };
    }
    if (table === 'stripe_connect_accounts') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: connectAccount, error: null }),
          }),
        }),
      };
    }
    if (table === 'services') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: service, error: null }),
            }),
          }),
        }),
      };
    }
    if (table === 'bookings') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockReturnValue({
                lt: vi.fn().mockReturnValue({
                  gt: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: booking, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    }
    if (table === 'payments') {
      return {
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    }
    return {};
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStripePaymentIntentsCreate.mockResolvedValue({
    id: 'pi_test',
    client_secret: 'cs_test',
  });
  mockStripeCheckoutSessionsCreate.mockResolvedValue({
    id: 'ses_test',
    url: 'https://checkout.stripe.com/test',
  });
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Idempotency keys — create-intent', () => {
  it('passes idempotencyKey to stripe.paymentIntents.create', async () => {
    mockSupabase();

    const { POST } = await import('@/app/api/payment/create-intent/route');
    const req = new Request('http://localhost/api/payment/create-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ professional_id: '00000000-0000-4000-a000-000000000001', service_id: '00000000-0000-4000-a000-000000000002' }),
    }) as any;

    const res = await POST(req);
    expect(res.status).toBe(200);

    // Verify Stripe was called with idempotencyKey option
    expect(mockStripePaymentIntentsCreate).toHaveBeenCalledTimes(1);
    const [, options] = mockStripePaymentIntentsCreate.mock.calls[0];
    expect(options).toHaveProperty('idempotencyKey');
    expect(options.idempotencyKey).toMatch(/^pi:00000000-0000-4000-a000-000000000001:00000000-0000-4000-a000-000000000002:/);
  });

  it('uses client-provided idempotency_key when sent', async () => {
    mockSupabase();

    const { POST } = await import('@/app/api/payment/create-intent/route');
    const req = new Request('http://localhost/api/payment/create-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        professional_id: '00000000-0000-4000-a000-000000000001',
        service_id: '00000000-0000-4000-a000-000000000002',
        idempotency_key: 'client-key-abc',
      }),
    }) as any;

    const res = await POST(req);
    expect(res.status).toBe(200);

    const [, options] = mockStripePaymentIntentsCreate.mock.calls[0];
    expect(options.idempotencyKey).toBe('client-key-abc');
  });

  it('generates different keys for different requests', async () => {
    mockSupabase();

    const { POST } = await import('@/app/api/payment/create-intent/route');

    const req1 = new Request('http://localhost/api/payment/create-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ professional_id: '00000000-0000-4000-a000-000000000001', service_id: '00000000-0000-4000-a000-000000000002' }),
    }) as any;
    await POST(req1);

    const req2 = new Request('http://localhost/api/payment/create-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ professional_id: '00000000-0000-4000-a000-000000000001', service_id: '00000000-0000-4000-a000-000000000002' }),
    }) as any;
    await POST(req2);

    const key1 = mockStripePaymentIntentsCreate.mock.calls[0][1].idempotencyKey;
    const key2 = mockStripePaymentIntentsCreate.mock.calls[1][1].idempotencyKey;
    expect(key1).not.toBe(key2);
  });
});

describe('Idempotency keys — checkout session', () => {
  it('passes idempotencyKey based on booking.id to stripe.checkout.sessions.create', async () => {
    mockSupabase();

    const { POST } = await import('@/app/api/bookings/checkout/route');
    const req = new Request('http://localhost/api/bookings/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        professional_id: '00000000-0000-4000-a000-000000000001',
        service_id: '00000000-0000-4000-a000-000000000002',
        booking_date: '2026-03-10',
        start_time: '10:00',
        client_name: 'Test Client',
        client_phone: '353800000001',
      }),
    }) as any;

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mockStripeCheckoutSessionsCreate).toHaveBeenCalledTimes(1);
    const [, options] = mockStripeCheckoutSessionsCreate.mock.calls[0];
    expect(options).toHaveProperty('idempotencyKey');
    expect(options.idempotencyKey).toBe('cs:booking-123');
  });
});
