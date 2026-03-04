import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #142: Admin session without server-side revocation
 *
 * Sessions were self-validating HMAC tokens — impossible to revoke, detect
 * theft, or limit concurrent sessions. Now sessions are stored server-side
 * (Redis with in-memory fallback) and validated against the store.
 */

describe('Admin session server-side revocation (issue #142)', () => {
  const source = readFileSync(
    resolve('src/lib/admin/session.ts'),
    'utf-8'
  );

  it('stores sessions server-side on generation', () => {
    expect(source).toContain('storeSession');
    // generateAdminToken must call storeSession
    const genFn = source.slice(
      source.indexOf('async function generateAdminToken'),
      source.indexOf('// ─── Token Validation')
    );
    expect(genFn).toContain('storeSession');
  });

  it('checks server-side store during validation', () => {
    expect(source).toContain('sessionExists');
    // validateAdminToken must call sessionExists
    const valFn = source.slice(
      source.indexOf('async function validateAdminToken'),
      source.indexOf('// ─── Session Revocation')
    );
    expect(valFn).toContain('sessionExists');
  });

  it('exports revokeAdminToken', () => {
    expect(source).toContain('export async function revokeAdminToken');
  });

  it('exports revokeAllAdminSessions', () => {
    expect(source).toContain('export async function revokeAllAdminSessions');
  });

  it('uses Redis for session storage when available', () => {
    expect(source).toContain('admin_session:');
    expect(source).toContain("client.set(`admin_session:");
  });

  it('has in-memory fallback for sessions', () => {
    expect(source).toContain('memorySessions');
  });

  it('auth route revokes session on logout (DELETE)', () => {
    const authSource = readFileSync(
      resolve('src/app/api/admin/auth/route.ts'),
      'utf-8'
    );
    expect(authSource).toContain('revokeAdminToken');
  });

  it('validateAdminToken is async (returns Promise)', () => {
    expect(source).toContain('async function validateAdminToken');
    expect(source).toContain('Promise<boolean>');
  });

  it('generateAdminToken is async (returns Promise)', () => {
    expect(source).toContain('async function generateAdminToken');
  });

  it('all admin routes use await with validateAdminToken', () => {
    const routes = [
      'src/app/api/admin/control-center/route.ts',
      'src/app/api/admin/control-center/[id]/resolve/route.ts',
      'src/app/api/admin/bot-e2e-toggle/route.ts',
      'src/app/api/admin/leads/[id]/toggle-bot/route.ts',
      'src/app/api/admin/leads/[id]/message/route.ts',
      'src/app/api/admin/evolution/check-connection/route.ts',
      'src/app/api/admin/evolution/create-instance/route.ts',
      'src/app/api/admin/restore-account/route.ts',
      'src/app/api/admin/inbox/route.ts',
    ];
    for (const route of routes) {
      const routeSource = readFileSync(resolve(route), 'utf-8');
      expect(routeSource).toContain('await validateAdminToken');
    }
  });
});

describe('Admin session revocation — functional tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    process.env.ADMIN_PASSWORD = 'test-password-for-revocation';
    delete process.env.STORAGE_URL;
    delete process.env.REDIS_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('generated token is valid', async () => {
    const { generateAdminToken, validateAdminToken } = await import('@/lib/admin/session');
    const { token } = await generateAdminToken();
    expect(await validateAdminToken(token)).toBe(true);
  });

  it('revoked token is rejected', async () => {
    const { generateAdminToken, validateAdminToken, revokeAdminToken } = await import('@/lib/admin/session');
    const { token } = await generateAdminToken();
    expect(await validateAdminToken(token)).toBe(true);

    await revokeAdminToken(token);
    expect(await validateAdminToken(token)).toBe(false);
  });

  it('revokeAllAdminSessions invalidates all tokens', async () => {
    const { generateAdminToken, validateAdminToken, revokeAllAdminSessions } = await import('@/lib/admin/session');
    const { token: t1 } = await generateAdminToken();
    const { token: t2 } = await generateAdminToken();
    expect(await validateAdminToken(t1)).toBe(true);
    expect(await validateAdminToken(t2)).toBe(true);

    await revokeAllAdminSessions();
    expect(await validateAdminToken(t1)).toBe(false);
    expect(await validateAdminToken(t2)).toBe(false);
  });

  it('revoking one token does not affect others', async () => {
    const { generateAdminToken, validateAdminToken, revokeAdminToken } = await import('@/lib/admin/session');
    const { token: t1 } = await generateAdminToken();
    const { token: t2 } = await generateAdminToken();

    await revokeAdminToken(t1);
    expect(await validateAdminToken(t1)).toBe(false);
    expect(await validateAdminToken(t2)).toBe(true);
  });

  it('revokeAdminToken handles invalid/undefined input gracefully', async () => {
    const { revokeAdminToken } = await import('@/lib/admin/session');
    // Should not throw
    await revokeAdminToken(undefined);
    await revokeAdminToken('');
    await revokeAdminToken('invalid');
  });

  it('token with valid HMAC but no server session is rejected', async () => {
    const { generateAdminToken, validateAdminToken, revokeAdminToken } = await import('@/lib/admin/session');
    const { token } = await generateAdminToken();

    // Revoke to remove from server store
    await revokeAdminToken(token);

    // HMAC is still valid, but server-side session is gone
    expect(await validateAdminToken(token)).toBe(false);
  });
});
