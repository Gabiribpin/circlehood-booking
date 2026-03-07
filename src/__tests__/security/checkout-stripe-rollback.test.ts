import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #136 + #355: Stripe session failure handling
 *
 * If stripe.checkout.sessions.create() fails, the booking must be rolled back
 * (cancelled) to free the slot.
 *
 * Issue #355: Stripe availability and deposit calculation are validated BEFORE
 * booking insert, so no rollback is needed for those pre-checks.
 */

describe('Checkout route Stripe rollback (issue #136, #355)', () => {
  const source = readFileSync(
    resolve('src/app/api/bookings/checkout/route.ts'),
    'utf-8'
  );

  it('wraps stripe.checkout.sessions.create in try-catch', () => {
    const stripeCreateIndex = source.indexOf('stripe.checkout.sessions.create');
    expect(stripeCreateIndex).toBeGreaterThan(-1);

    // Find the try { that precedes the Stripe call (search backward)
    const beforeStripe = source.slice(0, stripeCreateIndex);
    const lastTryIndex = beforeStripe.lastIndexOf('try {');
    expect(lastTryIndex).toBeGreaterThan(-1);

    // Find the catch after the Stripe call
    const afterStripe = source.slice(stripeCreateIndex);
    const catchIndex = afterStripe.indexOf('} catch');
    expect(catchIndex).toBeGreaterThan(-1);
  });

  it('cancels booking in catch block (rollback)', () => {
    // Extract the catch block content
    const catchIndex = source.indexOf('} catch');
    const afterCatch = source.slice(catchIndex);

    // Should cancel the booking
    expect(afterCatch).toContain("status: 'cancelled'");
    expect(afterCatch).toContain('booking.id');
  });

  it('returns an error response (not throwing) on Stripe failure', () => {
    // Find the catch block after stripe.checkout.sessions.create
    const stripeIndex = source.indexOf('stripe.checkout.sessions.create');
    const afterStripe = source.slice(stripeIndex);
    const catchIndex = afterStripe.indexOf('} catch');
    const catchBlock = afterStripe.slice(catchIndex, catchIndex + 500);

    // Should return a proper error response, not re-throw
    expect(catchBlock).toContain('NextResponse.json');
    expect(catchBlock).toContain('502');
  });

  it('validates Stripe availability BEFORE booking insert (#355)', () => {
    // Stripe null check must come BEFORE booking insert
    const stripeNullCheck = source.indexOf('if (!stripe)');
    const bookingInsert = source.indexOf("status: 'pending_payment'");
    expect(stripeNullCheck).toBeGreaterThan(-1);
    expect(stripeNullCheck).toBeLessThan(bookingInsert);
  });

  it('calculates deposit BEFORE booking insert (#355)', () => {
    const depositCalc = source.indexOf('calculateDeposit(');
    const bookingInsert = source.indexOf("status: 'pending_payment'");
    expect(depositCalc).toBeGreaterThan(-1);
    expect(depositCalc).toBeLessThan(bookingInsert);
  });

  it('inserts booking before Stripe session creation (intentional for slot reservation)', () => {
    // Booking insert must come BEFORE Stripe session creation
    // This is by design — the booking reserves the slot, Stripe is created after
    const insertIndex = source.indexOf(".insert({");
    const stripeIndex = source.indexOf("stripe.checkout.sessions.create");
    expect(insertIndex).toBeLessThan(stripeIndex);
  });

  it('uses idempotency key for retry safety', () => {
    expect(source).toContain('idempotencyKey');
    expect(source).toContain('booking.id');
  });
});
