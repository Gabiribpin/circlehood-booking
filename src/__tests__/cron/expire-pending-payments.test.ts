import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #5: pending_payment bookings never expire — slot blocked forever
 *
 * New cron /api/cron/expire-pending-payments expires bookings with
 * status=pending_payment and created_at older than 30 minutes.
 */

const routePath = resolve('src/app/api/cron/expire-pending-payments/route.ts');
const vercelPath = resolve('vercel.json');

describe('Cron: expire-pending-payments (issue #5)', () => {
  const source = readFileSync(routePath, 'utf-8');
  const vercelJson = JSON.parse(readFileSync(vercelPath, 'utf-8'));

  // ─── Route structure ──────────────────────────────────────────────────

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
    // Should NOT use createClient from @/lib/supabase/server
    expect(source).not.toContain("from '@/lib/supabase/server'");
  });

  // ─── Expiration logic ──────────────────────────────────────────────────

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

  it('does NOT expire recent bookings (< 30 min)', () => {
    // The cutoff is now - 30 min; .lt('created_at', cutoff) ensures
    // only bookings OLDER than 30 min are affected
    expect(source).toContain('Date.now() - EXPIRATION_MINUTES * 60 * 1000');
  });

  // ─── Logging ──────────────────────────────────────────────────────────

  it('logs to cron_logs on success', () => {
    expect(source).toContain("job_name: 'expire-pending-payments'");
    expect(source).toContain("status: 'success'");
  });

  it('logs to cron_logs on error', () => {
    expect(source).toContain("status: 'error'");
    expect(source).toContain('error_message');
  });

  it('returns expired count in response', () => {
    expect(source).toContain('expired: count');
  });

  // ─── Vercel cron config ────────────────────────────────────────────────

  it('is registered in vercel.json', () => {
    const cronEntry = vercelJson.crons.find(
      (c: { path: string }) => c.path === '/api/cron/expire-pending-payments'
    );
    expect(cronEntry).toBeDefined();
  });

  it('runs every hour', () => {
    const cronEntry = vercelJson.crons.find(
      (c: { path: string }) => c.path === '/api/cron/expire-pending-payments'
    );
    expect(cronEntry.schedule).toBe('0 * * * *');
  });
});
