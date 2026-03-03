import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #5: pending_payment bookings never expire — slot blocked forever
 *
 * Two-layer fix:
 * 1. Inline expiration in bookings/route.ts: expires stale pending_payment
 *    bookings BEFORE the conflict check (real-time, runs on every booking request)
 * 2. Daily cron /api/cron/expire-pending-payments: safety net for cleanup
 */

const cronPath = resolve('src/app/api/cron/expire-pending-payments/route.ts');
const bookingsPath = resolve('src/app/api/bookings/route.ts');
const vercelPath = resolve('vercel.json');

// ─── Cron route ──────────────────────────────────────────────────────────────

describe('Cron: expire-pending-payments (issue #5)', () => {
  const source = readFileSync(cronPath, 'utf-8');
  const vercelJson = JSON.parse(readFileSync(vercelPath, 'utf-8'));

  it('exports a POST handler', () => {
    expect(source).toContain('export async function POST');
  });

  it('is protected by CRON_SECRET via Bearer token', () => {
    expect(source).toContain("request.headers.get('authorization')");
    expect(source).toContain('Bearer ${cronSecret}');
    expect(source).toContain('status: 401');
  });

  it('uses service role client (not anon)', () => {
    expect(source).toContain("createClient(");
    expect(source).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(source).not.toContain("from '@/lib/supabase/server'");
  });

  it('targets bookings with status pending_payment', () => {
    expect(source).toContain("eq('status', 'pending_payment')");
  });

  it('uses 30 minute expiration window', () => {
    expect(source).toContain('EXPIRATION_MINUTES = 30');
  });

  it('filters by created_at < cutoff (older than 30 min)', () => {
    expect(source).toContain("lt('created_at', cutoff)");
  });

  it('updates status to expired', () => {
    expect(source).toContain("update({ status: 'expired' })");
  });

  it('logs to cron_logs on success and error', () => {
    expect(source).toContain("job_name: 'expire-pending-payments'");
    expect(source).toContain("status: 'success'");
    expect(source).toContain("status: 'error'");
  });

  it('is registered in vercel.json as daily cron', () => {
    const cronEntry = vercelJson.crons.find(
      (c: { path: string }) => c.path === '/api/cron/expire-pending-payments'
    );
    expect(cronEntry).toBeDefined();
    // Daily schedule (Vercel Hobby plan only supports once/day)
    expect(cronEntry.schedule).toBe('30 5 * * *');
  });
});

// ─── Inline expiration in bookings API ────────────────────────────────────────

describe('Inline expiration in bookings/route.ts (issue #5)', () => {
  const source = readFileSync(bookingsPath, 'utf-8');

  it('expires pending_payment before conflict check', () => {
    const expirationIndex = source.indexOf('pending_payment antigos');
    const conflictIndex = source.indexOf('Check double-booking');
    expect(expirationIndex).toBeGreaterThan(-1);
    expect(conflictIndex).toBeGreaterThan(-1);
    // Expiration must come BEFORE conflict check
    expect(expirationIndex).toBeLessThan(conflictIndex);
  });

  it('uses 30 minute cutoff', () => {
    expect(source).toContain('30 * 60 * 1000');
  });

  it('scopes expiration to same professional and date', () => {
    // The inline expiration should be scoped to avoid unnecessary updates
    const expirationBlock = source.slice(
      source.indexOf('paymentCutoff'),
      source.indexOf('9b. Check')
    );
    expect(expirationBlock).toContain("eq('professional_id', professional_id)");
    expect(expirationBlock).toContain("eq('booking_date', booking_date)");
    expect(expirationBlock).toContain("eq('status', 'pending_payment')");
    expect(expirationBlock).toContain("lt('created_at', paymentCutoff)");
  });

  it('sets status to expired', () => {
    const expirationBlock = source.slice(
      source.indexOf('paymentCutoff'),
      source.indexOf('9b. Check')
    );
    expect(expirationBlock).toContain("update({ status: 'expired' })");
  });
});
