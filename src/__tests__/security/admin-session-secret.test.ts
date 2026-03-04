import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #137: Admin password reused as HMAC secret
 *
 * The ADMIN_PASSWORD was used directly as HMAC signing key for admin tokens.
 * Now uses ADMIN_SESSION_SECRET (dedicated) with fallback to ADMIN_PASSWORD.
 */

describe('Admin session uses dedicated signing secret (issue #137)', () => {
  const source = readFileSync(
    resolve('src/lib/admin/session.ts'),
    'utf-8'
  );

  it('uses ADMIN_SESSION_SECRET env var', () => {
    expect(source).toContain('ADMIN_SESSION_SECRET');
  });

  it('does not use ADMIN_PASSWORD directly in generateAdminToken or validateAdminToken', () => {
    // ADMIN_PASSWORD should only appear in getSigningSecret as fallback, not in the token functions
    const lines = source.split('\n');
    for (const line of lines) {
      if (line.includes('ADMIN_PASSWORD') && !line.includes('getSigningSecret') && !line.includes('||') && !line.includes('//') && !line.includes('*') && !line.includes('Error')) {
        throw new Error(`ADMIN_PASSWORD used directly outside getSigningSecret: ${line.trim()}`);
      }
    }
  });

  it('has a getSigningSecret helper that prefers ADMIN_SESSION_SECRET', () => {
    expect(source).toContain('getSigningSecret');
    // Ensure ADMIN_SESSION_SECRET comes before ADMIN_PASSWORD (preferred)
    const fnMatch = source.match(/function getSigningSecret[\s\S]*?^}/m);
    expect(fnMatch).toBeTruthy();
    const fnBody = fnMatch![0];
    expect(fnBody).toContain('ADMIN_SESSION_SECRET');
    expect(fnBody).toContain('ADMIN_PASSWORD');
    const secretIdx = fnBody.indexOf('ADMIN_SESSION_SECRET');
    const passwordIdx = fnBody.indexOf('ADMIN_PASSWORD');
    expect(secretIdx).toBeLessThan(passwordIdx);
  });

  it('ADMIN_SESSION_SECRET is documented in .env.example', () => {
    const envExample = readFileSync(resolve('.env.example'), 'utf-8');
    expect(envExample).toContain('ADMIN_SESSION_SECRET');
  });
});

describe('Admin session token generation and validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('generates and validates token with ADMIN_SESSION_SECRET', async () => {
    process.env.ADMIN_SESSION_SECRET = 'dedicated-secret-64chars-long-for-security-purposes-1234567890ab';
    delete process.env.ADMIN_PASSWORD;

    const { generateAdminToken, validateAdminToken } = await import('@/lib/admin/session');
    const { token } = await generateAdminToken();
    expect(await validateAdminToken(token)).toBe(true);
  });

  it('falls back to ADMIN_PASSWORD when ADMIN_SESSION_SECRET is not set', async () => {
    delete process.env.ADMIN_SESSION_SECRET;
    process.env.ADMIN_PASSWORD = 'my-admin-password';

    const { generateAdminToken, validateAdminToken } = await import('@/lib/admin/session');
    const { token } = await generateAdminToken();
    expect(await validateAdminToken(token)).toBe(true);
  });

  it('prefers ADMIN_SESSION_SECRET over ADMIN_PASSWORD', async () => {
    process.env.ADMIN_SESSION_SECRET = 'dedicated-secret';
    process.env.ADMIN_PASSWORD = 'password-should-not-be-used';

    const { generateAdminToken, validateAdminToken } = await import('@/lib/admin/session');
    const { token } = await generateAdminToken();

    // Token generated with ADMIN_SESSION_SECRET should validate with it
    expect(await validateAdminToken(token)).toBe(true);

    // Now change ADMIN_SESSION_SECRET — token should be invalid
    process.env.ADMIN_SESSION_SECRET = 'different-secret';
    vi.resetModules();
    const mod = await import('@/lib/admin/session');
    expect(await mod.validateAdminToken(token)).toBe(false);
  });

  it('throws when neither secret is configured', async () => {
    delete process.env.ADMIN_SESSION_SECRET;
    delete process.env.ADMIN_PASSWORD;

    const { generateAdminToken } = await import('@/lib/admin/session');
    await expect(generateAdminToken()).rejects.toThrow();
  });

  it('returns false for validation when neither secret is configured', async () => {
    delete process.env.ADMIN_SESSION_SECRET;
    delete process.env.ADMIN_PASSWORD;

    const { validateAdminToken } = await import('@/lib/admin/session');
    expect(await validateAdminToken('some.token.here')).toBe(false);
  });
});
