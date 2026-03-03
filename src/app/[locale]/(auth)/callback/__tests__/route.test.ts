import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockExchangeCodeForSession = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { exchangeCodeForSession: (...args: unknown[]) => mockExchangeCodeForSession(...args) },
  }),
}));

const mockFrom = vi.fn();
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

import { GET } from '../route';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/callback');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString());
}

function mockProfessionalLookup(found: boolean) {
  mockFrom.mockImplementation(() => ({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: found ? { id: 'prof-1' } : null,
          error: null,
        }),
      }),
    }),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('GET /callback', () => {
  describe('PKCE exchange', () => {
    it('redirects to /login?error=auth when code is missing', async () => {
      const res = await GET(makeRequest());
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
    });

    it('redirects to /login?error=auth when exchange fails', async () => {
      mockExchangeCodeForSession.mockResolvedValue({
        error: new Error('invalid'),
        data: { session: null },
      });

      const res = await GET(makeRequest({ code: 'bad-code' }));
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get('location')!).pathname).toBe('/login');
    });

    it('redirects to /dashboard on successful exchange with existing professional', async () => {
      mockExchangeCodeForSession.mockResolvedValue({
        error: null,
        data: { session: { user: { id: 'user-1' } } },
      });
      mockProfessionalLookup(true);

      const res = await GET(makeRequest({ code: 'valid-code' }));
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get('location')!).pathname).toBe('/dashboard');
    });

    it('redirects to /complete-profile for new OAuth user', async () => {
      mockExchangeCodeForSession.mockResolvedValue({
        error: null,
        data: { session: { user: { id: 'user-new' } } },
      });
      mockProfessionalLookup(false);

      const res = await GET(makeRequest({ code: 'valid-code' }));
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get('location')!).pathname).toBe('/complete-profile');
    });
  });

  describe('open redirect prevention (sanitizeNext)', () => {
    it('allows valid relative path /settings', async () => {
      mockExchangeCodeForSession.mockResolvedValue({
        error: null,
        data: { session: { user: { id: 'user-1' } } },
      });
      mockProfessionalLookup(true);

      const res = await GET(makeRequest({ code: 'valid', next: '/settings' }));
      expect(new URL(res.headers.get('location')!).pathname).toBe('/settings');
    });

    it('blocks protocol-relative URL //evil.com', async () => {
      mockExchangeCodeForSession.mockResolvedValue({
        error: null,
        data: { session: { user: { id: 'user-1' } } },
      });
      mockProfessionalLookup(true);

      const res = await GET(makeRequest({ code: 'valid', next: '//evil.com' }));
      expect(new URL(res.headers.get('location')!).pathname).toBe('/dashboard');
    });

    it('blocks absolute URL https://evil.com', async () => {
      mockExchangeCodeForSession.mockResolvedValue({
        error: null,
        data: { session: { user: { id: 'user-1' } } },
      });
      mockProfessionalLookup(true);

      const res = await GET(makeRequest({ code: 'valid', next: 'https://evil.com' }));
      expect(new URL(res.headers.get('location')!).pathname).toBe('/dashboard');
    });

    it('falls back to /dashboard when next is empty', async () => {
      mockExchangeCodeForSession.mockResolvedValue({
        error: null,
        data: { session: { user: { id: 'user-1' } } },
      });
      mockProfessionalLookup(true);

      const res = await GET(makeRequest({ code: 'valid' }));
      expect(new URL(res.headers.get('location')!).pathname).toBe('/dashboard');
    });
  });
});
