import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockMaybeSingle = vi.fn();
const mockEqChain = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEqChain }));
const mockUpdate = vi.fn(() => ({ eq: vi.fn() }));
const mockFrom = vi.fn((table: string) => {
  if (table === 'professionals') {
    return { select: mockSelect, update: mockUpdate };
  }
  return { select: vi.fn(), update: vi.fn() };
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

// ─── Helper tests ────────────────────────────────────────────────────────────

describe('email/unsubscribe helpers', () => {
  const FAKE_TOKEN = 'a'.repeat(64);

  beforeEach(() => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://test.example.com';
  });

  it('getUnsubscribeUrl builds correct URL', async () => {
    const { getUnsubscribeUrl } = await import('@/lib/email/unsubscribe');
    const url = getUnsubscribeUrl(FAKE_TOKEN);
    expect(url).toBe(`https://test.example.com/api/email/unsubscribe?token=${FAKE_TOKEN}`);
  });

  it('getUnsubscribeHeaders returns List-Unsubscribe and List-Unsubscribe-Post', async () => {
    const { getUnsubscribeHeaders } = await import('@/lib/email/unsubscribe');
    const headers = getUnsubscribeHeaders(FAKE_TOKEN);
    expect(headers['List-Unsubscribe']).toContain(FAKE_TOKEN);
    expect(headers['List-Unsubscribe']).toMatch(/^<https?:\/\/.+>$/);
    expect(headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  it('getMarketingEmailFooter includes unsubscribe link', async () => {
    const { getMarketingEmailFooter } = await import('@/lib/email/unsubscribe');
    const footer = getMarketingEmailFooter(FAKE_TOKEN);
    expect(footer).toContain('Cancelar inscrição');
    expect(footer).toContain(FAKE_TOKEN);
    expect(footer).toContain('Dublin, Ireland');
    expect(footer).toContain('privacy@circlehood-tech.com');
  });

  it('getTransactionalEmailFooter does NOT include unsubscribe link', async () => {
    const { getTransactionalEmailFooter } = await import('@/lib/email/unsubscribe');
    const footer = getTransactionalEmailFooter();
    expect(footer).not.toContain('Cancelar inscrição');
    expect(footer).not.toContain('unsubscribe');
    expect(footer).toContain('Dublin, Ireland');
    expect(footer).toContain('privacy@circlehood-tech.com');
  });
});

// ─── Endpoint tests ──────────────────────────────────────────────────────────

describe('email/unsubscribe endpoint', () => {
  const VALID_TOKEN = 'b'.repeat(64);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET with invalid token returns 400', async () => {
    const { GET } = await import('@/app/api/email/unsubscribe/route');
    const request = new Request('https://test.example.com/api/email/unsubscribe?token=invalid');
    const response = await GET(request as any);
    expect(response.status).toBe(400);
    const html = await response.text();
    expect(html).toContain('inválido');
  });

  it('GET with unknown token returns 400', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const { GET } = await import('@/app/api/email/unsubscribe/route');
    const request = new Request(`https://test.example.com/api/email/unsubscribe?token=${VALID_TOKEN}`);
    const response = await GET(request as any);
    expect(response.status).toBe(400);
  });

  it('GET with valid token returns 200 and confirms unsubscribe', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'prof-1', business_name: 'Test Biz', marketing_emails_opted_out: false },
      error: null,
    });

    const { GET } = await import('@/app/api/email/unsubscribe/route');
    const request = new Request(`https://test.example.com/api/email/unsubscribe?token=${VALID_TOKEN}`);
    const response = await GET(request as any);
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('Inscrição cancelada');
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('GET is idempotent — does not re-update if already opted out', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'prof-1', business_name: 'Test Biz', marketing_emails_opted_out: true },
      error: null,
    });

    const { GET } = await import('@/app/api/email/unsubscribe/route');
    const request = new Request(`https://test.example.com/api/email/unsubscribe?token=${VALID_TOKEN}`);
    const response = await GET(request as any);
    expect(response.status).toBe(200);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('POST with valid token returns JSON success', async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: { id: 'prof-1', business_name: 'Test Biz', marketing_emails_opted_out: false },
      error: null,
    });

    const { POST } = await import('@/app/api/email/unsubscribe/route');
    const request = new Request(`https://test.example.com/api/email/unsubscribe?token=${VALID_TOKEN}`, {
      method: 'POST',
    });
    const response = await POST(request as any);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
  });

  it('POST with invalid token returns 400 JSON', async () => {
    const { POST } = await import('@/app/api/email/unsubscribe/route');
    const request = new Request('https://test.example.com/api/email/unsubscribe?token=short', {
      method: 'POST',
    });
    const response = await POST(request as any);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe('Invalid token');
  });
});

// ─── Cron source code verification ──────────────────────────────────────────

describe('cron compliance checks', () => {
  it('send-retention-emails filters opted-out and uses List-Unsubscribe', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const cronPath = path.resolve('src/app/api/cron/send-retention-emails/route.ts');
    const source = fs.readFileSync(cronPath, 'utf-8');

    expect(source).toContain("marketing_emails_opted_out");
    expect(source).toContain("getUnsubscribeHeaders");
    expect(source).toContain("getMarketingEmailFooter");
  });

  it('send-trial-expiration-notifications filters opted-out and uses List-Unsubscribe', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const cronPath = path.resolve('src/app/api/cron/send-trial-expiration-notifications/route.ts');
    const source = fs.readFileSync(cronPath, 'utf-8');

    expect(source).toContain("marketing_emails_opted_out");
    expect(source).toContain("getUnsubscribeHeaders");
    expect(source).toContain("getMarketingEmailFooter");
  });
});
