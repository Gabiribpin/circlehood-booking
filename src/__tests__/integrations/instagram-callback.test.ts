import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const AUTH_USER_ID = 'auth-user-uuid-1234';
const PROFESSIONAL_ID = 'prof-uuid-5678';

const mockGetUser = vi.fn();
const mockSingle = vi.fn();
const mockUpsert = vi.fn();
const mockSelect = vi.fn(() => ({
  eq: vi.fn(() => ({
    single: mockSingle,
  })),
}));
const mockFrom = vi.fn((table: string) => {
  if (table === 'professionals') {
    return { select: mockSelect };
  }
  if (table === 'integrations') {
    return { upsert: mockUpsert };
  }
  return {};
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  })),
}));

vi.mock('@/lib/integrations/instagram', () => ({
  exchangeCodeForToken: vi.fn(async () => ({
    accessToken: 'short-token',
    userId: 'ig-user-123',
  })),
  getLongLivedToken: vi.fn(async () => ({
    accessToken: 'long-lived-token',
    expiresIn: 5184000,
  })),
  getUserProfile: vi.fn(async () => ({
    username: 'testuser',
    accountType: 'PERSONAL',
    mediaCount: 42,
  })),
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Instagram callback route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_BASE_URL = 'https://test.example.com';
    process.env.INSTAGRAM_CLIENT_ID = 'test-client-id';
    process.env.INSTAGRAM_CLIENT_SECRET = 'test-client-secret';
  });

  it('uses professionals.id (not user.id) as professional_id in upsert', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: AUTH_USER_ID } },
    });
    mockSingle.mockResolvedValue({
      data: { id: PROFESSIONAL_ID },
      error: null,
    });
    mockUpsert.mockResolvedValue({ error: null });

    const { GET } = await import(
      '@/app/api/integrations/instagram/callback/route'
    );

    const request = new Request(
      `https://test.example.com/api/integrations/instagram/callback?code=test-auth-code`
    );
    await GET(request as any);

    // Verify upsert was called with professional.id, NOT auth user.id
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const upsertArg = mockUpsert.mock.calls[0][0];
    expect(upsertArg.professional_id).toBe(PROFESSIONAL_ID);
    expect(upsertArg.professional_id).not.toBe(AUTH_USER_ID);
  });

  it('redirects to onboarding if professional not found', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: AUTH_USER_ID } },
    });
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: 'not found' },
    });

    const { GET } = await import(
      '@/app/api/integrations/instagram/callback/route'
    );

    const request = new Request(
      `https://test.example.com/api/integrations/instagram/callback?code=test-auth-code`
    );
    const response = await GET(request as any);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/onboarding');
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('redirects to login if user not authenticated', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
    });

    const { GET } = await import(
      '@/app/api/integrations/instagram/callback/route'
    );

    const request = new Request(
      `https://test.example.com/api/integrations/instagram/callback?code=test-auth-code`
    );
    const response = await GET(request as any);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login');
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
