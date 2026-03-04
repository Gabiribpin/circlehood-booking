import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #140: No rate limiting on public bookings endpoint
 *
 * The bookings POST endpoint had no rate limiting, allowing spam of fake
 * bookings and flood of email/WhatsApp notifications.
 */

describe('Bookings rate limiting (issue #140)', () => {
  const source = readFileSync(
    resolve('src/app/api/bookings/route.ts'),
    'utf-8'
  );

  it('imports isRateLimited', () => {
    expect(source).toContain("import { isRateLimited } from '@/lib/rate-limit'");
  });

  it('calls isRateLimited before processing', () => {
    const rateLimitIndex = source.indexOf('isRateLimited');
    const parseIndex = source.indexOf('request.json()');
    expect(rateLimitIndex).toBeGreaterThan(-1);
    expect(parseIndex).toBeGreaterThan(-1);
    expect(rateLimitIndex).toBeLessThan(parseIndex);
  });

  it('returns 429 when rate limited', () => {
    expect(source).toContain('429');
  });

  it('rate limits by IP (x-forwarded-for)', () => {
    expect(source).toContain('x-forwarded-for');
  });

  it('uses a booking-specific key prefix', () => {
    expect(source).toContain('booking:');
  });

  it('has a reasonable rate limit (10/hour)', () => {
    expect(source).toContain('BOOKING_RATE_LIMIT');
    expect(source).toContain('BOOKING_RATE_WINDOW');
    // Verify the values
    expect(source).toMatch(/BOOKING_RATE_LIMIT\s*=\s*10/);
    expect(source).toMatch(/BOOKING_RATE_WINDOW\s*=\s*3600/);
  });
});

describe('Rate limit utility (issue #140)', () => {
  const source = readFileSync(
    resolve('src/lib/rate-limit.ts'),
    'utf-8'
  );

  it('uses Redis when available', () => {
    expect(source).toContain("import Redis from 'ioredis'");
    expect(source).toContain('client.incr');
    expect(source).toContain('client.expire');
  });

  it('falls back to in-memory when Redis unavailable', () => {
    expect(source).toContain('checkMemory');
  });

  it('catches Redis errors gracefully', () => {
    expect(source).toContain('} catch');
  });

  it('uses namespaced Redis keys', () => {
    expect(source).toContain('rate_limit:');
  });

  it('is a generic utility (accepts key, limit, windowSeconds)', () => {
    expect(source).toContain('key: string');
    expect(source).toContain('limit: number');
    expect(source).toContain('windowSeconds: number');
  });
});

describe('Rate limit utility — functional tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // No Redis in test — uses memory fallback
    delete process.env.STORAGE_URL;
    delete process.env.REDIS_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('allows requests within limit', async () => {
    const { isRateLimited } = await import('@/lib/rate-limit');
    const key = `test-allow-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      expect(await isRateLimited(key, 5, 60)).toBe(false);
    }
  });

  it('blocks requests exceeding limit', async () => {
    const { isRateLimited } = await import('@/lib/rate-limit');
    const key = `test-block-${Date.now()}`;
    for (let i = 0; i < 3; i++) {
      await isRateLimited(key, 3, 60);
    }
    expect(await isRateLimited(key, 3, 60)).toBe(true);
  });

  it('tracks different keys independently', async () => {
    const { isRateLimited } = await import('@/lib/rate-limit');
    const ts = Date.now();
    expect(await isRateLimited(`a-${ts}`, 1, 60)).toBe(false);
    expect(await isRateLimited(`b-${ts}`, 1, 60)).toBe(false);
  });
});
