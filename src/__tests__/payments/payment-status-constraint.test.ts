import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Issue #491: Payment status CHECK constraint must include all statuses
 * used by the Stripe webhook handler.
 */
describe('Payment status CHECK constraint covers all webhook statuses (issue #491)', () => {
  const migrationSource = readFileSync(
    resolve('supabase/migrations/20260310000003_payments_status_check_expand.sql'),
    'utf-8',
  );

  const webhookSource = readFileSync(
    resolve('src/app/api/webhooks/stripe-deposit/route.ts'),
    'utf-8',
  );

  // All payment statuses used by webhook (from .from('payments').update({ status: '...' }))
  const PAYMENT_STATUSES = [
    'pending', 'processing', 'succeeded', 'failed', 'refunded',
    'partially_refunded', 'disputed', 'cancelled',
  ];

  it('migration contains all payment statuses used by stripe-deposit webhook', () => {
    for (const status of PAYMENT_STATUSES) {
      expect(
        migrationSource,
        `Migration missing status '${status}'`,
      ).toContain(`'${status}'`);
    }
  });

  it('webhook uses partially_refunded, disputed, and cancelled', () => {
    expect(webhookSource).toContain("'partially_refunded'");
    expect(webhookSource).toContain("'disputed'");
    expect(webhookSource).toContain("'cancelled'");
  });

  it('migration has all core statuses', () => {
    for (const status of ['pending', 'processing', 'succeeded', 'failed', 'refunded']) {
      expect(migrationSource).toContain(`'${status}'`);
    }
  });

  it('migration drops old constraint before adding new one', () => {
    const dropIdx = migrationSource.indexOf('DROP CONSTRAINT');
    const addIdx = migrationSource.indexOf('ADD CONSTRAINT');
    expect(dropIdx).toBeGreaterThan(-1);
    expect(addIdx).toBeGreaterThan(-1);
    expect(dropIdx).toBeLessThan(addIdx);
  });
});
