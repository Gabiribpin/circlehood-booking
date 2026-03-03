import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #19: Admin auth uses static cookie without rate limiting
 *
 * Fixes:
 * 1. Token is unique per session (crypto.randomUUID + HMAC signature)
 * 2. Token is validated via HMAC (not compared to static '1')
 * 3. Rate limiting: 5 attempts per IP per 15 minutes
 * 4. Expiration reduced from 24h to 8h
 */

// ─── Token generation and validation ─────────────────────────────────────────

describe('Admin session token (issue #19)', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_PASSWORD', 'test-secret-password-123');
  });

  it('generates unique tokens on each call', async () => {
    const { generateAdminToken } = await import('@/lib/admin/session');
    const t1 = generateAdminToken();
    const t2 = generateAdminToken();
    expect(t1.token).not.toBe(t2.token);
  });

  it('generated token has 3 parts (sessionId.timestamp.signature)', async () => {
    const { generateAdminToken } = await import('@/lib/admin/session');
    const { token } = generateAdminToken();
    const parts = token.split('.');
    expect(parts).toHaveLength(3);
    // sessionId is a UUID
    expect(parts[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/);
    // timestamp is numeric
    expect(parseInt(parts[1])).toBeGreaterThan(0);
    // signature is hex
    expect(parts[2]).toMatch(/^[0-9a-f]{64}$/);
  });

  it('validates a freshly generated token', async () => {
    const { generateAdminToken, validateAdminToken } = await import('@/lib/admin/session');
    const { token } = generateAdminToken();
    expect(validateAdminToken(token)).toBe(true);
  });

  it('rejects undefined/empty tokens', async () => {
    const { validateAdminToken } = await import('@/lib/admin/session');
    expect(validateAdminToken(undefined)).toBe(false);
    expect(validateAdminToken('')).toBe(false);
  });

  it('rejects the old static value "1"', async () => {
    const { validateAdminToken } = await import('@/lib/admin/session');
    expect(validateAdminToken('1')).toBe(false);
  });

  it('rejects a forged token with wrong signature', async () => {
    const { generateAdminToken, validateAdminToken } = await import('@/lib/admin/session');
    const { token } = generateAdminToken();
    const parts = token.split('.');
    parts[2] = 'a'.repeat(64); // forged signature
    expect(validateAdminToken(parts.join('.'))).toBe(false);
  });

  it('rejects a token with tampered sessionId', async () => {
    const { generateAdminToken, validateAdminToken } = await import('@/lib/admin/session');
    const { token } = generateAdminToken();
    const parts = token.split('.');
    parts[0] = '00000000-0000-4000-a000-000000000099'; // different UUID
    expect(validateAdminToken(parts.join('.'))).toBe(false);
  });

  it('sets expiration to 8 hours', async () => {
    const { generateAdminToken } = await import('@/lib/admin/session');
    const before = Date.now();
    const { expires } = generateAdminToken();
    const after = Date.now();
    const eightHoursMs = 8 * 60 * 60 * 1000;
    expect(expires.getTime()).toBeGreaterThanOrEqual(before + eightHoursMs - 100);
    expect(expires.getTime()).toBeLessThanOrEqual(after + eightHoursMs + 100);
  });
});

// ─── Rate limiting ───────────────────────────────────────────────────────────

describe('Admin rate limiting (issue #19)', () => {
  it('allows first 5 attempts from same IP', async () => {
    // Use fresh import to reset state
    vi.resetModules();
    const { isRateLimited } = await import('@/lib/admin/session');
    const testIp = `rate-test-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      expect(isRateLimited(testIp)).toBe(false);
    }
  });

  it('blocks 6th attempt from same IP', async () => {
    vi.resetModules();
    const { isRateLimited } = await import('@/lib/admin/session');
    const testIp = `rate-block-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      isRateLimited(testIp);
    }
    expect(isRateLimited(testIp)).toBe(true);
  });

  it('allows attempts from different IPs', async () => {
    vi.resetModules();
    const { isRateLimited } = await import('@/lib/admin/session');
    const ts = Date.now();
    expect(isRateLimited(`ip-a-${ts}`)).toBe(false);
    expect(isRateLimited(`ip-b-${ts}`)).toBe(false);
    expect(isRateLimited(`ip-c-${ts}`)).toBe(false);
  });
});

// ─── Code verification ───────────────────────────────────────────────────────

describe('Admin auth code verification (issue #19)', () => {
  it('auth route uses generateAdminToken (not static "1")', () => {
    const source = readFileSync(
      resolve('src/app/api/admin/auth/route.ts'),
      'utf-8'
    );
    expect(source).toContain('generateAdminToken');
    expect(source).not.toContain("'1'");
  });

  it('auth route has rate limiting', () => {
    const source = readFileSync(
      resolve('src/app/api/admin/auth/route.ts'),
      'utf-8'
    );
    expect(source).toContain('isRateLimited');
    expect(source).toContain('429');
  });

  it('auth route sets secure cookie flag', () => {
    const source = readFileSync(
      resolve('src/app/api/admin/auth/route.ts'),
      'utf-8'
    );
    expect(source).toContain('secure: true');
  });

  it('admin layout uses validateAdminToken', () => {
    const source = readFileSync(
      resolve('src/app/[locale]/(admin)/layout.tsx'),
      'utf-8'
    );
    expect(source).toContain('validateAdminToken');
    expect(source).not.toContain("!== '1'");
  });

  const adminRoutes = [
    'src/app/api/admin/control-center/route.ts',
    'src/app/api/admin/control-center/[id]/resolve/route.ts',
    'src/app/api/admin/bot-e2e-toggle/route.ts',
    'src/app/api/admin/leads/[id]/toggle-bot/route.ts',
    'src/app/api/admin/leads/[id]/message/route.ts',
    'src/app/api/admin/evolution/check-connection/route.ts',
    'src/app/api/admin/evolution/create-instance/route.ts',
    'src/app/api/admin/restore-account/route.ts',
  ];

  for (const route of adminRoutes) {
    it(`${route} uses validateAdminToken`, () => {
      const source = readFileSync(resolve(route), 'utf-8');
      expect(source).toContain('validateAdminToken');
      expect(source).not.toContain("!== '1'");
    });
  }
});
