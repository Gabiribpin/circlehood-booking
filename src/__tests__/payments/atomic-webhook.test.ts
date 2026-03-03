import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('Atomic webhook — code verification (#4)', () => {
  const webhookPath = join(
    process.cwd(),
    'src/app/api/webhooks/stripe-deposit/route.ts',
  );
  const migrationPath = join(
    process.cwd(),
    'supabase/migrations/20260303000002_confirm_booking_payment_atomic.sql',
  );

  it('webhook uses .rpc() instead of separate .update() calls for checkout.session.completed', () => {
    const source = readFileSync(webhookPath, 'utf-8');
    expect(source).toContain("supabase.rpc(");
    expect(source).toContain("'confirm_booking_payment'");
  });

  it('webhook does NOT use separate booking + payment updates in checkout.session.completed', () => {
    const source = readFileSync(webhookPath, 'utf-8');

    // Find the checkout.session.completed case block
    const checkoutStart = source.indexOf("case 'checkout.session.completed':");
    const checkoutEnd = source.indexOf('break;', checkoutStart);
    const checkoutBlock = source.slice(checkoutStart, checkoutEnd);

    // Should NOT have .from('bookings').update() or .from('payments').update() in this block
    expect(checkoutBlock).not.toMatch(/\.from\(['"]bookings['"]\)\s*\n\s*\.update/);
    expect(checkoutBlock).not.toMatch(/\.from\(['"]payments['"]\)\s*\n\s*\.update/);
  });

  it('webhook returns 500 on RPC error (so Stripe retries)', () => {
    const source = readFileSync(webhookPath, 'utf-8');
    expect(source).toContain('rpcError');
    expect(source).toContain("status: 500");
  });

  it('migration file exists with confirm_booking_payment function', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf-8');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION confirm_booking_payment');
    expect(sql).toContain('p_booking_id uuid');
    expect(sql).toContain('p_checkout_session_id text');
  });

  it('RPC function updates both bookings and payments in same transaction', () => {
    const sql = readFileSync(migrationPath, 'utf-8');
    expect(sql).toContain("UPDATE bookings");
    expect(sql).toContain("SET status = 'confirmed'");
    expect(sql).toContain("UPDATE payments");
    expect(sql).toContain("SET status = 'succeeded'");
  });

  it('RPC function only confirms bookings with pending_payment status', () => {
    const sql = readFileSync(migrationPath, 'utf-8');
    expect(sql).toContain("AND status = 'pending_payment'");
  });
});
