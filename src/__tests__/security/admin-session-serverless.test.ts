import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for admin session graceful degradation on serverless (Vercel).
 *
 * On Vercel, each serverless function has its own in-memory store.
 * A session created in one instance may not exist in another's memory.
 * Without Redis, validation must gracefully accept tokens with valid
 * HMAC+timestamp rather than locking out the user.
 */

describe('Admin session serverless cross-instance behavior', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.ADMIN_PASSWORD = 'test-password-serverless';
    // No Redis — simulates serverless without shared store
    delete process.env.STORAGE_URL;
    delete process.env.REDIS_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('token generated in instance A is valid in same instance', async () => {
    const { generateAdminToken, validateAdminToken } = await import('@/lib/admin/session');
    const { token } = await generateAdminToken();
    expect(await validateAdminToken(token)).toBe(true);
  });

  it('token is accepted in a fresh instance (simulating cross-instance)', async () => {
    // Instance A generates the token
    const { generateAdminToken } = await import('@/lib/admin/session');
    const { token } = await generateAdminToken();

    // Reset modules to simulate a fresh serverless instance (Instance B)
    vi.resetModules();
    process.env.ADMIN_PASSWORD = 'test-password-serverless';
    delete process.env.STORAGE_URL;
    delete process.env.REDIS_URL;

    const { validateAdminToken } = await import('@/lib/admin/session');
    // Instance B has no memory of this session, but HMAC+timestamp are valid
    expect(await validateAdminToken(token)).toBe(true);
  });

  it('revoked token is rejected in same instance', async () => {
    const { generateAdminToken, validateAdminToken, revokeAdminToken } = await import('@/lib/admin/session');
    const { token } = await generateAdminToken();
    expect(await validateAdminToken(token)).toBe(true);

    await revokeAdminToken(token);
    expect(await validateAdminToken(token)).toBe(false);
  });

  it('revokeAll rejects tokens created before revocation in same instance', async () => {
    const { generateAdminToken, validateAdminToken, revokeAllAdminSessions } = await import('@/lib/admin/session');
    const { token } = await generateAdminToken();
    expect(await validateAdminToken(token)).toBe(true);

    await revokeAllAdminSessions();
    expect(await validateAdminToken(token)).toBe(false);
  });

  it('revokeAll allows tokens created after revocation', async () => {
    const { generateAdminToken, validateAdminToken, revokeAllAdminSessions } = await import('@/lib/admin/session');
    await revokeAllAdminSessions();

    // Small delay to ensure timestamp is after revokeAll
    await new Promise((r) => setTimeout(r, 10));

    const { token } = await generateAdminToken();
    expect(await validateAdminToken(token)).toBe(true);
  });

  it('expired token is rejected even without session store', async () => {
    const { generateAdminToken, validateAdminToken } = await import('@/lib/admin/session');
    const { token } = await generateAdminToken();

    // Manually create an expired token by manipulating timestamp
    const parts = token.split('.');
    const expiredTimestamp = (Date.now() - 9 * 60 * 60 * 1000).toString(); // 9 hours ago (> 8h expiry)
    const { createHmac } = await import('crypto');
    const payload = `${parts[0]}.${expiredTimestamp}`;
    const signature = createHmac('sha256', 'test-password-serverless').update(payload).digest('hex');
    const expiredToken = `${parts[0]}.${expiredTimestamp}.${signature}`;

    expect(await validateAdminToken(expiredToken)).toBe(false);
  });

  it('invalid HMAC is rejected regardless of session store', async () => {
    const { validateAdminToken } = await import('@/lib/admin/session');
    const fakeToken = `fake-session.${Date.now()}.invalidsignature`;
    expect(await validateAdminToken(fakeToken)).toBe(false);
  });

  it('undefined/empty tokens are rejected', async () => {
    const { validateAdminToken } = await import('@/lib/admin/session');
    expect(await validateAdminToken(undefined)).toBe(false);
    expect(await validateAdminToken('')).toBe(false);
    expect(await validateAdminToken('malformed')).toBe(false);
  });
});
