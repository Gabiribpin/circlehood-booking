import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetUser = vi.fn();
const mockSupabaseFrom = vi.fn();
const mockStripeAccountsCreate = vi.fn();
const mockStripeAccountLinksCreate = vi.fn();
const mockStripeAccountsCreateLoginLink = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
    from: mockSupabaseFrom,
  })),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: mockSupabaseFrom,
  })),
}));

vi.mock('@/lib/stripe/server', () => ({
  getStripeServer: vi.fn(() => ({
    accounts: {
      create: mockStripeAccountsCreate,
      createLoginLink: mockStripeAccountsCreateLoginLink,
    },
    accountLinks: {
      create: mockStripeAccountLinksCreate,
    },
  })),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMockChain(returnValue: unknown) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'maybeSingle', 'single', 'insert', 'upsert', 'update'];
  methods.forEach((m) => {
    chain[m] = vi.fn(() => chain);
  });
  (chain as any).then = (resolve: (v: unknown) => void) => Promise.resolve(returnValue).then(resolve);
  Object.defineProperty(chain, Symbol.toStringTag, { value: 'Promise' });
  return chain;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Stripe Connect: status API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns connected:false when no connect account', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'professionals') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 'prof-1' } }),
        };
      }
      if (table === 'stripe_connect_accounts') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null }),
        };
      }
      return makeMockChain({ data: null });
    });

    const { GET } = await import('@/app/api/stripe/connect/status/route');
    const req = new Request('http://localhost/api/stripe/connect/status');
    const res = await GET(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.connected).toBe(false);
  });

  it('returns connect status when account exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockSupabaseFrom.mockImplementation((table: string) => {
      if (table === 'professionals') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { id: 'prof-1' } }),
        };
      }
      if (table === 'stripe_connect_accounts') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              stripe_account_id: 'acct_test123',
              charges_enabled: true,
              payouts_enabled: true,
              onboarding_complete: true,
            },
          }),
        };
      }
      return makeMockChain({ data: null });
    });

    const { GET } = await import('@/app/api/stripe/connect/status/route');
    const req = new Request('http://localhost/api/stripe/connect/status');
    const res = await GET(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.connected).toBe(true);
    expect(json.charges_enabled).toBe(true);
    expect(json.stripe_account_id).toBe('acct_test123');
  });

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { GET } = await import('@/app/api/stripe/connect/status/route');
    const req = new Request('http://localhost/api/stripe/connect/status');
    const res = await GET(req as any);

    expect(res.status).toBe(401);
  });
});

describe('Stripe Connect: dashboard-link API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns login link URL', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockSupabaseFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { stripe_account_id: 'acct_test123' },
      }),
    }));
    mockStripeAccountsCreateLoginLink.mockResolvedValue({
      url: 'https://connect.stripe.com/express/dashboard',
    });

    const { POST } = await import('@/app/api/stripe/connect/dashboard-link/route');
    const req = new Request('http://localhost/api/stripe/connect/dashboard-link', {
      method: 'POST',
    });
    const res = await POST(req as any);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.url).toContain('stripe.com');
    expect(mockStripeAccountsCreateLoginLink).toHaveBeenCalledWith('acct_test123');
  });

  it('returns 404 when no stripe account', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockSupabaseFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { stripe_account_id: null } }),
    }));

    const { POST } = await import('@/app/api/stripe/connect/dashboard-link/route');
    const req = new Request('http://localhost/api/stripe/connect/dashboard-link', {
      method: 'POST',
    });
    const res = await POST(req as any);

    expect(res.status).toBe(404);
  });
});
