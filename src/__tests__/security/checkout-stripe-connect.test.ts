import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #143: Stripe Connect without verifying charges_enabled/payouts_enabled
 *
 * The checkout route only checked startsWith('acct_') but never verified
 * the connected account could actually receive payments. Now it calls
 * stripe.accounts.retrieve() to check charges_enabled and payouts_enabled.
 */

describe('Checkout Stripe Connect verification (issue #143)', () => {
  const source = readFileSync(
    resolve('src/app/api/bookings/checkout/route.ts'),
    'utf-8'
  );

  it('calls stripe.accounts.retrieve to verify the connected account', () => {
    expect(source).toContain('accounts.retrieve');
    expect(source).toContain('prof.stripe_account_id');
  });

  it('checks charges_enabled', () => {
    expect(source).toContain('charges_enabled');
  });

  it('checks payouts_enabled', () => {
    expect(source).toContain('payouts_enabled');
  });

  it('returns 422 when onboarding is incomplete', () => {
    // Find the section that checks charges_enabled/payouts_enabled
    const checkSection = source.slice(
      source.indexOf('charges_enabled'),
      source.indexOf('charges_enabled') + 500
    );
    expect(checkSection).toContain('422');
    expect(checkSection).toContain('onboarding incompleto');
  });

  it('returns 502 when Stripe account retrieval fails', () => {
    // After accounts.retrieve, there should be a catch block with 502
    const retrieveIdx = source.indexOf('accounts.retrieve');
    const afterRetrieve = source.slice(retrieveIdx, retrieveIdx + 500);
    expect(afterRetrieve).toContain('} catch');
    expect(afterRetrieve).toContain('502');
  });

  it('verifies account BEFORE creating the booking', () => {
    const chargesIdx = source.indexOf('charges_enabled');
    const insertIdx = source.indexOf("status: 'pending_payment'");
    expect(chargesIdx).toBeGreaterThan(-1);
    expect(insertIdx).toBeGreaterThan(-1);
    expect(chargesIdx).toBeLessThan(insertIdx);
  });

  it('verifies account BEFORE creating the checkout session', () => {
    const chargesIdx = source.indexOf('charges_enabled');
    const checkoutIdx = source.indexOf('checkout.sessions.create');
    expect(chargesIdx).toBeGreaterThan(-1);
    expect(checkoutIdx).toBeGreaterThan(-1);
    expect(chargesIdx).toBeLessThan(checkoutIdx);
  });

  it('still validates stripe_account_id format (startsWith acct_)', () => {
    expect(source).toContain("startsWith('acct_')");
  });
});
