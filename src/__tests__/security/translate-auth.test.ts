import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROUTE_PATH = path.resolve(
  __dirname,
  '../../app/api/translate/route.ts',
);

const content = fs.readFileSync(ROUTE_PATH, 'utf-8');

describe('/api/translate — security', () => {
  it('imports createClient from supabase/server', () => {
    expect(content).toContain("import { createClient } from '@/lib/supabase/server'");
  });

  it('calls supabase.auth.getUser()', () => {
    expect(content).toContain('supabase.auth.getUser()');
  });

  it('returns 401 when user is not authenticated', () => {
    expect(content).toContain("{ error: 'Unauthorized' }");
    expect(content).toContain('status: 401');
  });

  it('imports isRateLimited', () => {
    expect(content).toContain("import { isRateLimited } from '@/lib/rate-limit'");
  });

  it('applies rate limiting per user', () => {
    expect(content).toMatch(/isRateLimited\(`rl:translate:\$\{user\.id\}`/);
  });

  it('returns 429 when rate limited', () => {
    expect(content).toContain("{ error: 'Too many requests' }");
    expect(content).toContain('status: 429');
  });

  it('still validates required fields', () => {
    expect(content).toContain('!text || !from || !to');
    expect(content).toContain('status: 400');
  });

  it('has try/catch with logger.error', () => {
    expect(content).toContain('} catch');
    expect(content).toContain("logger.error('[translate]'");
  });

  it('auth check comes before request.json() parsing', () => {
    const authIndex = content.indexOf('getUser()');
    const jsonIndex = content.indexOf('request.json()');
    expect(authIndex).toBeLessThan(jsonIndex);
  });

  it('rate limit check comes before Anthropic API call', () => {
    const rateLimitIndex = content.indexOf('isRateLimited');
    const anthropicIndex = content.indexOf('new Anthropic');
    expect(rateLimitIndex).toBeLessThan(anthropicIndex);
  });
});
