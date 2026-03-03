import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const AUTH_USER_ID = 'auth-user-uuid-1234';
const PROFESSIONAL_ID = 'prof-uuid-5678';

const mockGetUser = vi.fn();
const mockRpc = vi.fn();
const mockSingle = vi.fn();
const mockSelectChain = vi.fn();
const mockInsertSelect = vi.fn(() => ({ single: vi.fn(() => ({ data: { id: 'campaign-1' }, error: null })) }));
const mockInsert = vi.fn(() => ({ select: mockInsertSelect }));
const mockOrder = vi.fn(() => ({ eq: vi.fn(() => ({ data: [], error: null })), data: [], error: null }));
const mockEq = vi.fn();

const mockFrom = vi.fn((table: string) => {
  if (table === 'professionals') {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockSingle,
        })),
      })),
    };
  }
  if (table === 'email_campaigns') {
    return {
      select: vi.fn(() => ({
        eq: mockEq.mockReturnValue({
          order: mockOrder,
        }),
      })),
      insert: mockInsert,
    };
  }
  return {};
});

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('email-campaigns route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: AUTH_USER_ID } } });
    mockSingle.mockResolvedValue({ data: { id: PROFESSIONAL_ID }, error: null });
    mockRpc.mockResolvedValue({ data: [], error: null });
  });

  describe('GET', () => {
    it('uses professionals.id (not user.id) to filter campaigns', async () => {
      const { GET } = await import('@/app/api/email-campaigns/route');
      const request = new Request('https://test.example.com/api/email-campaigns');
      await GET(request as any);

      // Verify eq was called with professional.id
      expect(mockEq).toHaveBeenCalledWith('professional_id', PROFESSIONAL_ID);
      expect(mockEq).not.toHaveBeenCalledWith('professional_id', AUTH_USER_ID);
    });

    it('returns 404 if professional not found', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });

      const { GET } = await import('@/app/api/email-campaigns/route');
      const request = new Request('https://test.example.com/api/email-campaigns');
      const response = await GET(request as any);

      expect(response.status).toBe(404);
    });

    it('returns 401 if not authenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });

      const { GET } = await import('@/app/api/email-campaigns/route');
      const request = new Request('https://test.example.com/api/email-campaigns');
      const response = await GET(request as any);

      expect(response.status).toBe(401);
    });
  });

  describe('POST', () => {
    const validBody = {
      name: 'Test Campaign',
      subject: 'Hello',
      fromName: 'Test',
      fromEmail: 'test@example.com',
      htmlContent: '<p>Hello</p>',
    };

    it('uses professionals.id (not user.id) in insert and RPC', async () => {
      const { POST } = await import('@/app/api/email-campaigns/route');
      const request = new Request('https://test.example.com/api/email-campaigns', {
        method: 'POST',
        body: JSON.stringify(validBody),
        headers: { 'Content-Type': 'application/json' },
      });
      await POST(request as any);

      // Verify RPC uses professional.id
      expect(mockRpc).toHaveBeenCalledWith('get_contacts_by_segment', expect.objectContaining({
        p_professional_id: PROFESSIONAL_ID,
      }));

      // Verify insert uses professional.id
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        professional_id: PROFESSIONAL_ID,
      }));
      expect(mockInsert).not.toHaveBeenCalledWith(expect.objectContaining({
        professional_id: AUTH_USER_ID,
      }));
    });

    it('returns 404 if professional not found', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });

      const { POST } = await import('@/app/api/email-campaigns/route');
      const request = new Request('https://test.example.com/api/email-campaigns', {
        method: 'POST',
        body: JSON.stringify(validBody),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request as any);

      expect(response.status).toBe(404);
      expect(mockInsert).not.toHaveBeenCalled();
    });
  });
});
