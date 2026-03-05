import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #154: Env vars validation at startup
 *
 * Critical environment variables were not validated, causing cryptic
 * runtime errors. Now src/lib/env.ts provides Zod schemas that fail
 * fast with descriptive messages.
 */

describe('Environment validation module — code verification (issue #154)', () => {
  const source = readFileSync(resolve('src/lib/env.ts'), 'utf-8');

  it('uses Zod for validation', () => {
    expect(source).toContain("from 'zod'");
  });

  it('validates NEXT_PUBLIC_SUPABASE_URL', () => {
    expect(source).toContain('NEXT_PUBLIC_SUPABASE_URL');
  });

  it('validates NEXT_PUBLIC_SUPABASE_ANON_KEY', () => {
    expect(source).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  });

  it('validates SUPABASE_SERVICE_ROLE_KEY', () => {
    expect(source).toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('validates ADMIN_PASSWORD', () => {
    expect(source).toContain('ADMIN_PASSWORD');
  });

  it('validates CRON_SECRET', () => {
    expect(source).toContain('CRON_SECRET');
  });

  it('exports validateServerEnv function', () => {
    expect(source).toContain('export function validateServerEnv');
  });

  it('exports validateClientEnv function', () => {
    expect(source).toContain('export function validateClientEnv');
  });

  it('uses safeParse for graceful error handling', () => {
    expect(source).toContain('safeParse');
  });

  it('throws descriptive error with all missing vars', () => {
    expect(source).toContain('Missing or invalid environment variables');
  });
});

describe('Environment validation — functional tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('validateServerEnv succeeds with all required vars', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.ADMIN_PASSWORD = 'test-password';
    process.env.CRON_SECRET = 'test-cron-secret';

    const { validateServerEnv } = await import('@/lib/env');
    const result = validateServerEnv();
    expect(result.NEXT_PUBLIC_SUPABASE_URL).toBe('https://test.supabase.co');
  });

  it('validateServerEnv throws when NEXT_PUBLIC_SUPABASE_URL is missing', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'key';
    process.env.ADMIN_PASSWORD = 'pw';
    process.env.CRON_SECRET = 'secret';

    const { validateServerEnv } = await import('@/lib/env');
    expect(() => validateServerEnv()).toThrow('NEXT_PUBLIC_SUPABASE_URL');
  });

  it('validateServerEnv throws when SUPABASE_SERVICE_ROLE_KEY is missing', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'key';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.ADMIN_PASSWORD = 'pw';
    process.env.CRON_SECRET = 'secret';

    const { validateServerEnv } = await import('@/lib/env');
    expect(() => validateServerEnv()).toThrow('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('validateServerEnv throws with invalid URL', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'not-a-url';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'key';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'key';
    process.env.ADMIN_PASSWORD = 'pw';
    process.env.CRON_SECRET = 'secret';

    const { validateServerEnv } = await import('@/lib/env');
    expect(() => validateServerEnv()).toThrow();
  });

  it('validateClientEnv succeeds with public vars', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key';

    const { validateClientEnv } = await import('@/lib/env');
    const result = validateClientEnv();
    expect(result.NEXT_PUBLIC_SUPABASE_URL).toBe('https://test.supabase.co');
  });

  it('validateClientEnv throws when anon key is missing', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const { validateClientEnv } = await import('@/lib/env');
    expect(() => validateClientEnv()).toThrow();
  });

  it('error message lists all missing vars', async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.ADMIN_PASSWORD;
    delete process.env.CRON_SECRET;

    const { validateServerEnv } = await import('@/lib/env');
    try {
      validateServerEnv();
      expect.fail('Should have thrown');
    } catch (err: any) {
      expect(err.message).toContain('NEXT_PUBLIC_SUPABASE_URL');
      expect(err.message).toContain('SUPABASE_SERVICE_ROLE_KEY');
      expect(err.message).toContain('ADMIN_PASSWORD');
      expect(err.message).toContain('CRON_SECRET');
    }
  });
});
