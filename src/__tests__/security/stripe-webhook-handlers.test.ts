import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const WEBHOOK_PATH = join(
  __dirname,
  '..',
  '..',
  'app',
  'api',
  'webhooks',
  'stripe-deposit',
  'route.ts'
);

const MIGRATION_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  'supabase',
  'migrations',
  '20260304000008_payments_refund_fields.sql'
);

describe('Stripe webhook refund/chargeback handlers (#115)', () => {
  const source = readFileSync(WEBHOOK_PATH, 'utf-8');

  it('handles charge.refunded event', () => {
    expect(source).toContain("case 'charge.refunded':");
  });

  it('handles charge.dispute.created event (chargebacks)', () => {
    expect(source).toContain("case 'charge.dispute.created':");
  });

  it('handles payment_intent.canceled event', () => {
    expect(source).toContain("case 'payment_intent.canceled':");
  });

  it('distinguishes full vs partial refunds', () => {
    expect(source).toContain('partially_refunded');
    expect(source).toContain('charge.refunded');
  });

  it('tracks refunded_amount', () => {
    expect(source).toContain('refunded_amount');
    expect(source).toContain('amount_refunded');
  });

  it('sets disputed status on chargeback', () => {
    expect(source).toContain("status: 'disputed'");
  });

  it('sets cancelled status on payment_intent.canceled', () => {
    expect(source).toContain("status: 'cancelled'");
  });

  describe('migration', () => {
    it('migration file exists', () => {
      expect(existsSync(MIGRATION_PATH)).toBe(true);
    });

    it('adds refunded_amount column', () => {
      const migration = readFileSync(MIGRATION_PATH, 'utf-8');
      expect(migration).toContain('refunded_amount');
    });
  });
});
