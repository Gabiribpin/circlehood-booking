import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #189: Rate limiting missing on registration endpoints.
 * Without rate limiting, attackers can create thousands of accounts,
 * exhausting Supabase Auth quotas.
 */

const registerPath = resolve('src/app/api/register/route.ts');
const signupPath = resolve('src/app/api/auth/signup-with-verification/route.ts');

describe('/api/register rate limiting (issue #189)', () => {
  const source = readFileSync(registerPath, 'utf-8');

  it('has rate limiting implementation', () => {
    expect(source).toContain('isRateLimited');
    expect(source).toContain('rateLimitMap');
  });

  it('returns 429 when rate limited', () => {
    expect(source).toContain('status: 429');
  });

  it('rate limits by IP address', () => {
    expect(source).toContain('x-forwarded-for');
  });

  it('uses a 1-hour window', () => {
    expect(source).toContain('60 * 60 * 1000');
  });

  it('allows max 5 registrations per window', () => {
    expect(source).toContain('RATE_LIMIT_MAX = 5');
  });

  it('checks rate limit before processing request body', () => {
    const rateLimitPos = source.indexOf('isRateLimited(ip)');
    const jsonParsePos = source.indexOf('req.json()');
    expect(rateLimitPos).toBeGreaterThan(-1);
    expect(rateLimitPos).toBeLessThan(jsonParsePos);
  });
});

describe('/api/auth/signup-with-verification rate limiting (issue #189)', () => {
  const source = readFileSync(signupPath, 'utf-8');

  it('has rate limiting implementation', () => {
    expect(source).toContain('isRateLimited');
    expect(source).toContain('rateLimitMap');
  });

  it('returns 429 when rate limited', () => {
    expect(source).toContain('status: 429');
  });

  it('rate limits by IP address', () => {
    expect(source).toContain('x-forwarded-for');
  });

  it('uses a 1-hour window', () => {
    expect(source).toContain('60 * 60 * 1000');
  });

  it('allows max 5 registrations per window', () => {
    expect(source).toContain('RATE_LIMIT_MAX = 5');
  });

  it('checks rate limit before processing request body', () => {
    const postBody = source.slice(source.indexOf('export async function POST'));
    const rateLimitPos = postBody.indexOf('isRateLimited(ip)');
    const jsonParsePos = postBody.indexOf('req.json()');
    expect(rateLimitPos).toBeGreaterThan(-1);
    expect(rateLimitPos).toBeLessThan(jsonParsePos);
  });
});
