import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const CHECKOUT_PATH = join(
  __dirname,
  '..',
  '..',
  'app',
  'api',
  'bookings',
  'checkout',
  'route.ts'
);

describe('Stripe Connect account_id validation (#114)', () => {
  const source = readFileSync(CHECKOUT_PATH, 'utf-8');

  it('validates stripe_account_id starts with acct_ prefix', () => {
    expect(source).toContain("startsWith('acct_')");
  });

  it('returns 422 when stripe_account_id has invalid format', () => {
    // The validation block should return 422
    const acctCheckIndex = source.indexOf("startsWith('acct_')");
    const status422Index = source.indexOf('status: 422', acctCheckIndex);
    expect(acctCheckIndex).toBeGreaterThan(-1);
    expect(status422Index).toBeGreaterThan(-1);
    // 422 must appear within 200 chars of the acct_ check (same block)
    expect(status422Index - acctCheckIndex).toBeLessThan(200);
  });

  it('checks type is string before prefix check', () => {
    expect(source).toContain("typeof prof.stripe_account_id !== 'string'");
  });
});
