import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #139: Rate limiting admin in-memory resets on deploy
 *
 * The in-memory Map reset on every deploy, allowing brute force across deploys.
 * Now uses Redis (INCR + EXPIRE) when available, with in-memory fallback.
 */

describe('Admin rate limiting uses Redis (issue #139)', () => {
  const source = readFileSync(
    resolve('src/lib/admin/session.ts'),
    'utf-8'
  );

  it('imports Redis (ioredis)', () => {
    expect(source).toContain("import Redis from 'ioredis'");
  });

  it('uses STORAGE_URL or REDIS_URL for connection', () => {
    expect(source).toContain('STORAGE_URL');
    expect(source).toContain('REDIS_URL');
  });

  it('isRateLimited is async (returns Promise)', () => {
    expect(source).toContain('async function isRateLimited');
    expect(source).toContain('Promise<boolean>');
  });

  it('uses Redis INCR + EXPIRE pattern', () => {
    expect(source).toContain('client.incr(key)');
    expect(source).toContain('client.expire(key');
  });

  it('uses a namespaced Redis key', () => {
    expect(source).toContain('admin_rate_limit:');
  });

  it('falls back to in-memory when Redis is unavailable', () => {
    expect(source).toContain('isRateLimitedMemory');
  });

  it('catches Redis errors and falls back gracefully', () => {
    // Should have a try-catch around Redis calls
    const redisSection = source.slice(source.indexOf('async function isRateLimited'));
    expect(redisSection).toContain('} catch');
    expect(redisSection).toContain('isRateLimitedMemory');
  });

  it('auth route awaits isRateLimited (async)', () => {
    const authSource = readFileSync(
      resolve('src/app/api/admin/auth/route.ts'),
      'utf-8'
    );
    expect(authSource).toContain('await isRateLimited');
  });
});
