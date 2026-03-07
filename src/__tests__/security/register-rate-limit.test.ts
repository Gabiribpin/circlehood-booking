import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #189: Rate limiting missing on registration endpoints.
 * Without rate limiting, attackers can create thousands of accounts,
 * exhausting Supabase Auth quotas.
 *
 * Updated for #352/#353: now uses Redis-backed isRateLimited() from @/lib/rate-limit.
 */

const registerPath = resolve('src/app/api/register/route.ts');
const signupPath = resolve('src/app/api/auth/signup-with-verification/route.ts');

describe('/api/register rate limiting (issue #189, #352)', () => {
  const source = readFileSync(registerPath, 'utf-8');

  it('has Redis-backed rate limiting implementation', () => {
    expect(source).toContain('isRateLimited');
    expect(source).toContain("from '@/lib/rate-limit'");
  });

  it('returns 429 when rate limited', () => {
    expect(source).toContain('status: 429');
  });

  it('rate limits by IP address', () => {
    expect(source).toContain('x-forwarded-for');
  });

  it('uses rl:register key prefix', () => {
    expect(source).toContain('rl:register:');
  });

  it('checks rate limit before processing request body', () => {
    const rateLimitPos = source.indexOf('isRateLimited');
    const jsonParsePos = source.indexOf('req.json()');
    expect(rateLimitPos).toBeGreaterThan(-1);
    expect(rateLimitPos).toBeLessThan(jsonParsePos);
  });
});

describe('/api/auth/signup-with-verification rate limiting (issue #189, #353)', () => {
  const source = readFileSync(signupPath, 'utf-8');

  it('has Redis-backed rate limiting implementation', () => {
    expect(source).toContain('isRateLimited');
    expect(source).toContain("from '@/lib/rate-limit'");
  });

  it('returns 429 when rate limited', () => {
    expect(source).toContain('status: 429');
  });

  it('rate limits by IP address', () => {
    expect(source).toContain('x-forwarded-for');
  });

  it('uses rl:register key prefix', () => {
    expect(source).toContain('rl:register:');
  });

  it('checks rate limit before processing request body', () => {
    const postBody = source.slice(source.indexOf('export async function POST'));
    const rateLimitPos = postBody.indexOf('isRateLimited');
    const jsonParsePos = postBody.indexOf('req.json()');
    expect(rateLimitPos).toBeGreaterThan(-1);
    expect(rateLimitPos).toBeLessThan(jsonParsePos);
  });
});
