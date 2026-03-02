import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock supabase — default returns a valid instance with webhook_secret
const mockSingle = vi.fn().mockResolvedValue({
  data: { webhook_secret: 'stored-secret-123' },
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: mockSingle,
        })),
      })),
    })),
  })),
}));

import { validateEvolutionWebhook } from '../webhook-auth';

function makeHeaders(entries: Record<string, string> = {}): Headers {
  return new Headers(entries);
}

describe('validateEvolutionWebhook (per-instance model)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: { webhook_secret: 'stored-secret-123' } });
    delete process.env.EVOLUTION_WEBHOOK_STRICT;
    // @ts-expect-error — NODE_ENV assignment needed for test isolation
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('strict mode (production)', () => {
    beforeEach(() => {
      // @ts-expect-error — NODE_ENV assignment needed for test isolation
      process.env.NODE_ENV = 'production';
    });

    it('rejects request without any auth header', async () => {
      const headers = makeHeaders();
      expect(await validateEvolutionWebhook(headers, 'inst-1')).toBe(false);
    });

    it('accepts request with matching apikey header', async () => {
      const headers = makeHeaders({ apikey: 'stored-secret-123' });
      expect(await validateEvolutionWebhook(headers, 'inst-1')).toBe(true);
    });

    it('accepts request with matching x-webhook-secret header', async () => {
      const headers = makeHeaders({ 'x-webhook-secret': 'stored-secret-123' });
      expect(await validateEvolutionWebhook(headers, 'inst-1')).toBe(true);
    });

    it('rejects request with wrong secret', async () => {
      const headers = makeHeaders({ apikey: 'wrong-secret' });
      expect(await validateEvolutionWebhook(headers, 'inst-1')).toBe(false);
    });

    it('rejects when instance not found in DB', async () => {
      mockSingle.mockResolvedValue({ data: null });
      const headers = makeHeaders({ apikey: 'stored-secret-123' });
      expect(await validateEvolutionWebhook(headers, 'unknown-inst')).toBe(false);
    });

    it('rejects when instance has no webhook_secret (pre-migration)', async () => {
      mockSingle.mockResolvedValue({ data: { webhook_secret: null } });
      const headers = makeHeaders({ apikey: 'some-key' });
      expect(await validateEvolutionWebhook(headers, 'inst-1')).toBe(false);
    });
  });

  describe('non-strict mode (dev)', () => {
    beforeEach(() => {
      // @ts-expect-error — NODE_ENV assignment needed for test isolation
      process.env.NODE_ENV = 'test';
      process.env.EVOLUTION_WEBHOOK_STRICT = 'false';
    });

    it('allows request without auth header', async () => {
      const headers = makeHeaders();
      expect(await validateEvolutionWebhook(headers, 'inst-1')).toBe(true);
    });

    it('validates normally when header is present', async () => {
      const headers = makeHeaders({ apikey: 'stored-secret-123' });
      expect(await validateEvolutionWebhook(headers, 'inst-1')).toBe(true);
    });

    it('rejects wrong secret even in dev', async () => {
      const headers = makeHeaders({ apikey: 'wrong' });
      expect(await validateEvolutionWebhook(headers, 'inst-1')).toBe(false);
    });

    it('allows when instance has no webhook_secret in dev', async () => {
      mockSingle.mockResolvedValue({ data: { webhook_secret: null } });
      const headers = makeHeaders({ apikey: 'some-key' });
      expect(await validateEvolutionWebhook(headers, 'inst-1')).toBe(true);
    });
  });

  describe('EVOLUTION_WEBHOOK_STRICT env override', () => {
    it('strict=true overrides NODE_ENV=test', async () => {
      // @ts-expect-error — NODE_ENV assignment needed for test isolation
      process.env.NODE_ENV = 'test';
      process.env.EVOLUTION_WEBHOOK_STRICT = 'true';
      const headers = makeHeaders();
      expect(await validateEvolutionWebhook(headers, 'inst-1')).toBe(false);
    });
  });
});
