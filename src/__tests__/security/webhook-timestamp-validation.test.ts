import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #150: Webhook Stripe without timestamp validation (replay attack)
 *
 * The webhook handler did not verify event.created, allowing replay attacks
 * with old events. Now rejects events older than 5 minutes.
 */

describe('Stripe webhook timestamp validation (issue #150)', () => {
  const source = readFileSync(
    resolve('src/app/api/webhooks/stripe-deposit/route.ts'),
    'utf-8',
  );

  it('checks event.created timestamp', () => {
    expect(source).toContain('event.created');
  });

  it('defines a max age constant', () => {
    expect(source).toContain('EVENT_MAX_AGE_SECONDS');
  });

  it('max age defaults to 300 seconds (5 minutes)', () => {
    expect(source).toContain("'300'");
    expect(source).toContain('STRIPE_EVENT_MAX_AGE_SECONDS');
  });

  it('calculates event age from current time', () => {
    expect(source).toContain('Date.now()');
    expect(source).toContain('event.created');
  });

  it('rejects stale events with 400 status', () => {
    // Find the stale event check section
    const staleIdx = source.indexOf('Event too old');
    expect(staleIdx).toBeGreaterThan(-1);
    // Should return 400
    const surroundingCode = source.slice(Math.max(0, staleIdx - 100), staleIdx + 100);
    expect(surroundingCode).toContain('400');
  });

  it('logs rejected stale events', () => {
    expect(source).toContain('rejected stale event');
  });

  it('timestamp check happens before event processing (switch)', () => {
    const timestampIdx = source.indexOf('EVENT_MAX_AGE_SECONDS');
    const switchIdx = source.indexOf('switch (event.type)');
    expect(timestampIdx).toBeGreaterThan(-1);
    expect(switchIdx).toBeGreaterThan(-1);
    expect(timestampIdx).toBeLessThan(switchIdx);
  });

  it('timestamp check happens after dedup check', () => {
    const dedupIdx = source.indexOf('isEventProcessed');
    const timestampIdx = source.indexOf('EVENT_MAX_AGE_SECONDS');
    expect(dedupIdx).toBeGreaterThan(-1);
    expect(timestampIdx).toBeGreaterThan(-1);
    expect(dedupIdx).toBeLessThan(timestampIdx);
  });
});
