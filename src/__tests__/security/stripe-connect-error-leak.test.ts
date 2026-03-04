import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #148: Stripe Connect error exposes internal details
 *
 * The catch block in create-account/route.ts was returning `detail: message`
 * which could leak Stripe API error details to the client. Now only a
 * generic error message is returned; details are logged server-side only.
 */

describe('Stripe Connect error response — no internal details (issue #148)', () => {
  const source = readFileSync(
    resolve('src/app/api/stripe/connect/create-account/route.ts'),
    'utf-8',
  );

  it('does not expose error detail in response', () => {
    // The response JSON should NOT contain a "detail" field
    expect(source).not.toContain('detail: message');
    expect(source).not.toContain('detail: err');
  });

  it('returns a generic error message', () => {
    expect(source).toContain("'Failed to create Stripe Connect account'");
  });

  it('logs the actual error server-side', () => {
    expect(source).toContain("logger.error('[stripe/connect/create-account] error:'");
  });

  it('does not expose stack traces', () => {
    expect(source).not.toContain('stack:');
    expect(source).not.toContain('.stack');
  });

  it('other Stripe Connect routes also do not leak details', () => {
    const routes = [
      'src/app/api/stripe/connect/status/route.ts',
      'src/app/api/stripe/connect/dashboard-link/route.ts',
      'src/app/api/stripe/connect/refresh-onboarding/route.ts',
    ];

    for (const route of routes) {
      const routeSource = readFileSync(resolve(route), 'utf-8');
      expect(routeSource).not.toContain('detail: message');
      expect(routeSource).not.toContain('detail: err');
    }
  });
});
