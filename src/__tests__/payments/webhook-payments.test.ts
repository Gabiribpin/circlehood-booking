import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockSupabaseFrom = vi.fn();
const mockConstructEvent = vi.fn();

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: mockSupabaseFrom,
    auth: {
      admin: {
        getUserById: vi.fn().mockResolvedValue({ data: { user: { email: 'pro@test.com' } } }),
      },
    },
  })),
}));

vi.mock('@/lib/stripe/server', () => ({
  getStripeServer: vi.fn(() => ({
    webhooks: {
      constructEvent: mockConstructEvent,
    },
  })),
}));

vi.mock('@/lib/resend', () => ({
  sendBookingConfirmationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/whatsapp/evolution', () => ({
  sendEvolutionMessage: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/email/safe-send', () => ({
  safeSendEmail: vi.fn((fn: () => Promise<void>) => fn().catch(() => {})),
}));

vi.mock('@/lib/whatsapp/safe-send', () => ({
  safeSendWhatsApp: vi.fn((fn: () => Promise<void>) => fn().catch(() => {})),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeChain(returnValue: unknown = { data: null, error: null }) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'in', 'update', 'insert', 'single', 'maybeSingle'];
  methods.forEach((m) => {
    chain[m] = vi.fn(() => chain);
  });
  (chain as any).then = (resolve: (v: unknown) => void) =>
    Promise.resolve(returnValue).then(resolve);
  return chain;
}

function makeRequest(body: string, signature: string) {
  return {
    text: () => Promise.resolve(body),
    headers: { get: (h: string) => (h === 'stripe-signature' ? signature : null) },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('stripe-deposit webhook: checkout.session.completed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_DEPOSIT_WEBHOOK_SECRET = 'whsec_test';
  });

  it('confirma booking e atualiza payment', async () => {
    const bookingId = '00000000-0000-4000-a000-000000000001';

    const sessionEvent = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          payment_intent: 'pi_test_456',
          metadata: { type: 'deposit', booking_id: bookingId },
        },
      },
    };

    mockConstructEvent.mockReturnValue(sessionEvent);

    const bookingUpdateChain = makeChain({ data: { id: bookingId }, error: null });
    const paymentUpdateChain = makeChain({ data: {}, error: null });
    const bookingSelectChain = makeChain({
      data: {
        id: bookingId,
        professional_id: 'prof-1',
        client_name: 'Test Client',
        client_email: null,
        client_phone: null,
        booking_date: '2026-03-01',
        start_time: '10:00:00',
        end_time: '11:00:00',
        services: { name: 'Corte', price: 50 },
      },
    });
    const profChain = makeChain({
      data: { user_id: 'user-1', business_name: 'Test Business', currency: 'EUR' },
    });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'bookings') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: {}, error: null }) }),
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue(bookingSelectChain) }),
          }),
        };
      }
      if (table === 'payments') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
          }),
        };
      }
      if (table === 'professionals') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue(profChain) }),
          }),
        };
      }
      return makeChain({ data: null });
    });

    const { POST } = await import('@/app/api/webhooks/stripe-deposit/route');
    const req = makeRequest('{}', 'sig_test');
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);
  });

  it('rejeita assinatura inválida', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const { POST } = await import('@/app/api/webhooks/stripe-deposit/route');
    const req = makeRequest('{}', 'invalid_sig');
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });

  it('retorna 400 quando falta stripe-signature', async () => {
    const { POST } = await import('@/app/api/webhooks/stripe-deposit/route');
    const req = {
      text: () => Promise.resolve('{}'),
      headers: { get: () => null },
    };
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });
});

describe('stripe-connect webhook: account.updated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET = 'whsec_connect_test';
  });

  it('atualiza status da conta connect', async () => {
    const accountEvent = {
      type: 'account.updated',
      data: {
        object: {
          id: 'acct_test123',
          charges_enabled: true,
          payouts_enabled: true,
          details_submitted: true,
        },
      },
    };

    mockConstructEvent.mockReturnValue(accountEvent);

    const connectUpdateFn = vi.fn().mockResolvedValue({ data: {}, error: null });
    const profUpdateFn = vi.fn().mockResolvedValue({ data: {}, error: null });

    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'stripe_connect_accounts') {
        return {
          update: vi.fn().mockReturnValue({
            eq: connectUpdateFn,
          }),
        };
      }
      if (table === 'professionals') {
        return {
          update: vi.fn().mockReturnValue({
            eq: profUpdateFn,
          }),
        };
      }
      return makeChain({ data: null });
    });

    const { POST } = await import('@/app/api/webhooks/stripe-connect/route');
    const req = makeRequest('{}', 'sig_test');
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.received).toBe(true);
  });

  it('rejeita assinatura inválida no webhook connect', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const { POST } = await import('@/app/api/webhooks/stripe-connect/route');
    const req = makeRequest('{}', 'bad_sig');
    const res = await POST(req as any);

    expect(res.status).toBe(400);
  });
});
