import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockCalculateDeposit = vi.fn();
const mockStripeCreate = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/stripe/server', () => ({
  getStripeServer: vi.fn(() => ({
    checkout: { sessions: { create: mockStripeCreate } },
  })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock('@/lib/payment/calculate-deposit', () => ({
  calculateDeposit: (...args: unknown[]) => mockCalculateDeposit(...args),
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

function setupMocks() {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'professionals') return makeChain({ data: PROF, error: null });
    if (table === 'services') return makeChain({ data: SERVICE, error: null });
    if (table === 'bookings') {
      const chain = makeChain({ data: [], error: null });
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
    if (table === 'payments') return { insert: vi.fn(() => Promise.resolve({ error: null })) };
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

describe('checkout amount validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_BASE_URL = 'https://test.example.com';
    setupMocks();
  });

  it('rejects deposit amount = 0', async () => {
    mockCalculateDeposit.mockReturnValue(0);

    const { POST } = await import('@/app/api/bookings/checkout/route');
    const response = await POST(makeRequest() as any);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('maior que zero');
  });

  it('rejects negative deposit amount', async () => {
    mockCalculateDeposit.mockReturnValue(-5);

    const { POST } = await import('@/app/api/bookings/checkout/route');
    const response = await POST(makeRequest() as any);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('maior que zero');
  });

  it('rejects deposit amount exceeding service price', async () => {
    mockCalculateDeposit.mockReturnValue(150); // service.price = 100

    const { POST } = await import('@/app/api/bookings/checkout/route');
    const response = await POST(makeRequest() as any);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('exceder');
  });

  it('allows valid deposit amount', async () => {
    mockCalculateDeposit.mockReturnValue(30);
    mockStripeCreate.mockResolvedValue({
      id: 'cs_test',
      url: 'https://checkout.stripe.com/test',
      payment_intent: 'pi_test',
    });

    const { POST } = await import('@/app/api/bookings/checkout/route');
    const response = await POST(makeRequest() as any);

    expect(response.status).toBe(200);
  });

  it('allows deposit equal to service price', async () => {
    mockCalculateDeposit.mockReturnValue(100); // exactly service.price

    mockStripeCreate.mockResolvedValue({
      id: 'cs_test',
      url: 'https://checkout.stripe.com/test',
      payment_intent: 'pi_test',
    });

    const { POST } = await import('@/app/api/bookings/checkout/route');
    const response = await POST(makeRequest() as any);

    expect(response.status).toBe(200);
  });
});
