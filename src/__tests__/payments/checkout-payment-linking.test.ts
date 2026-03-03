import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockStripeCheckoutSessionsCreate = vi.fn();

vi.mock('@/lib/stripe/server', () => ({
  getStripeServer: vi.fn(() => ({
    checkout: { sessions: { create: mockStripeCheckoutSessionsCreate } },
  })),
}));

const mockInsertPayment = vi.fn();
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
        professional_id: data.professional_id ?? 'prof-1',
        service_id: data.service_id ?? 'svc-1',
        booking_date: '2026-04-01',
        start_time: '10:00',
        client_name: 'Test Client',
        client_phone: '+353800000000',
      },
    })),
  },
  sanitizeString: vi.fn((s: string) => s),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Creates a fluent chain mock where every method returns self, resolving to returnValue */
function makeChain(returnValue: unknown = { data: null, error: null }) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'in', 'lt', 'gt', 'update', 'insert', 'single', 'maybeSingle', 'order'];
  methods.forEach((m) => {
    chain[m] = vi.fn(() => chain);
  });
  (chain as any).then = (resolve: (v: unknown) => void) =>
    Promise.resolve(returnValue).then(resolve);
  return chain;
}

const PROF = {
  subscription_status: 'active',
  trial_ends_at: '2099-01-01',
  stripe_account_id: 'acct_test',
  currency: 'eur',
  require_deposit: true,
  deposit_type: 'percentage',
  deposit_value: 30,
};

const SERVICE = { duration_minutes: 60, name: 'Corte', price: 100 };
const BOOKING = { id: 'booking-uuid-1' };

function setupDefaultMocks() {
  mockInsertPayment.mockResolvedValue({ error: null });

  mockFrom.mockImplementation((table: string) => {
    if (table === 'professionals') {
      return makeChain({ data: PROF, error: null });
    }
    if (table === 'services') {
      return makeChain({ data: SERVICE, error: null });
    }
    if (table === 'bookings') {
      const chain = makeChain({ data: [], error: null });
      // Override insert to return booking with select().single() chain
      chain.insert = vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: BOOKING, error: null })),
        })),
      }));
      chain.update = vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null })),
      }));
      return chain;
    }
    if (table === 'payments') {
      return { insert: mockInsertPayment };
    }
    return makeChain();
  });
}

function makeRequest() {
  return new Request('https://test.example.com/api/bookings/checkout', {
    method: 'POST',
    body: JSON.stringify({
      professional_id: 'prof-1',
      service_id: 'svc-1',
      booking_date: '2026-04-01',
      start_time: '10:00',
      client_name: 'Test Client',
      client_phone: '+353800000000',
    }),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('checkout payment linking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_BASE_URL = 'https://test.example.com';
    setupDefaultMocks();
  });

  it('stores stripe_payment_intent_id from checkout session', async () => {
    mockStripeCheckoutSessionsCreate.mockResolvedValue({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/test',
      payment_intent: 'pi_test_456',
    });

    const { POST } = await import('@/app/api/bookings/checkout/route');
    const response = await POST(makeRequest() as any);

    expect(response.status).toBe(200);
    expect(mockInsertPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_checkout_session_id: 'cs_test_123',
        stripe_payment_intent_id: 'pi_test_456',
        booking_id: 'booking-uuid-1',
      })
    );
  });

  it('handles null payment_intent gracefully', async () => {
    mockStripeCheckoutSessionsCreate.mockResolvedValue({
      id: 'cs_test_789',
      url: 'https://checkout.stripe.com/test',
      payment_intent: null,
    });

    const { POST } = await import('@/app/api/bookings/checkout/route');
    const response = await POST(makeRequest() as any);

    expect(response.status).toBe(200);
    expect(mockInsertPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_checkout_session_id: 'cs_test_789',
        stripe_payment_intent_id: null,
      })
    );
  });

  it('rolls back booking if payment insert fails', async () => {
    mockStripeCheckoutSessionsCreate.mockResolvedValue({
      id: 'cs_test_fail',
      url: 'https://checkout.stripe.com/test',
      payment_intent: 'pi_test_fail',
    });
    mockInsertPayment.mockResolvedValue({ error: { message: 'DB error' } });

    const { POST } = await import('@/app/api/bookings/checkout/route');
    const response = await POST(makeRequest() as any);

    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toContain('Failed to create payment record');
  });
});
