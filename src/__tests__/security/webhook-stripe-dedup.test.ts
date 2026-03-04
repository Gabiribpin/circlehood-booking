import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #144: Stripe webhook without reprocessing protection
 *
 * Stripe can retry webhooks on timeout, causing duplicate booking
 * confirmations and notification spam. Now uses event ID dedup via
 * Redis (with in-memory fallback) to skip already-processed events.
 */

describe('Stripe webhook dedup — code verification (issue #144)', () => {
  const source = readFileSync(
    resolve('src/app/api/webhooks/stripe-deposit/route.ts'),
    'utf-8'
  );

  it('imports event dedup utilities', () => {
    expect(source).toContain("import { isEventProcessed, markEventProcessed }");
  });

  it('checks isEventProcessed before processing', () => {
    const checkIdx = source.indexOf('isEventProcessed');
    const switchIdx = source.indexOf('switch (event.type)');
    expect(checkIdx).toBeGreaterThan(-1);
    expect(switchIdx).toBeGreaterThan(-1);
    expect(checkIdx).toBeLessThan(switchIdx);
  });

  it('calls markEventProcessed after successful handling', () => {
    const markIdx = source.lastIndexOf('markEventProcessed');
    const returnIdx = source.lastIndexOf("{ received: true }");
    expect(markIdx).toBeGreaterThan(-1);
    expect(returnIdx).toBeGreaterThan(-1);
    expect(markIdx).toBeLessThan(returnIdx);
  });

  it('returns early with deduplicated flag when event already processed', () => {
    expect(source).toContain('deduplicated: true');
  });

  it('checkout.session.completed uses idempotent status guard', () => {
    const checkoutSection = source.slice(
      source.indexOf("'checkout.session.completed'"),
      source.indexOf("'checkout.session.completed'") + 500
    );
    expect(checkoutSection).toContain("eq('status', 'pending_payment')");
  });
});

describe('Event dedup utility — code verification', () => {
  const source = readFileSync(
    resolve('src/lib/webhooks/event-dedup.ts'),
    'utf-8'
  );

  it('uses Redis for event storage when available', () => {
    expect(source).toContain("import Redis from 'ioredis'");
    expect(source).toContain('webhook_event:');
  });

  it('has in-memory fallback', () => {
    expect(source).toContain('memoryEvents');
  });

  it('uses TTL for automatic cleanup', () => {
    expect(source).toContain('EVENT_TTL_SECONDS');
    expect(source).toContain("'EX'");
  });

  it('TTL covers Stripe retry window (72h)', () => {
    expect(source).toContain('72 * 60 * 60');
  });

  it('exports isEventProcessed and markEventProcessed', () => {
    expect(source).toContain('export async function isEventProcessed');
    expect(source).toContain('export async function markEventProcessed');
  });
});

describe('Event dedup utility — functional tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.STORAGE_URL;
    delete process.env.REDIS_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('new event is not marked as processed', async () => {
    const { isEventProcessed } = await import('@/lib/webhooks/event-dedup');
    expect(await isEventProcessed(`evt_new_${Date.now()}`)).toBe(false);
  });

  it('marks and detects processed event', async () => {
    const { isEventProcessed, markEventProcessed } = await import('@/lib/webhooks/event-dedup');
    const eventId = `evt_test_${Date.now()}`;

    expect(await isEventProcessed(eventId)).toBe(false);
    await markEventProcessed(eventId);
    expect(await isEventProcessed(eventId)).toBe(true);
  });

  it('different event IDs are tracked independently', async () => {
    const { isEventProcessed, markEventProcessed } = await import('@/lib/webhooks/event-dedup');
    const ts = Date.now();

    await markEventProcessed(`evt_a_${ts}`);
    expect(await isEventProcessed(`evt_a_${ts}`)).toBe(true);
    expect(await isEventProcessed(`evt_b_${ts}`)).toBe(false);
  });
});
