import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #183: /api/payment/create-intent without proper validation
 *
 * The route creates Stripe PaymentIntents. It must:
 * 1. Rate limit requests to prevent abuse
 * 2. Validate UUID format for IDs
 * 3. Verify Stripe Connect charges_enabled before creating PI
 * 4. Calculate amount server-side from DB (not from body)
 * 5. Verify service belongs to professional
 */

const routePath = resolve('src/app/api/payment/create-intent/route.ts');
const source = readFileSync(routePath, 'utf-8');

describe('create-intent rate limiting (issue #183)', () => {
  it('has rate limiting implementation', () => {
    expect(source).toContain('isRateLimited');
    expect(source).toContain("from '@/lib/rate-limit'");
  });

  it('returns 429 when rate limited', () => {
    expect(source).toContain('status: 429');
  });

  it('rate limits by IP address', () => {
    expect(source).toContain('x-forwarded-for');
  });
});

describe('create-intent UUID validation (issue #183)', () => {
  it('validates UUID format for professional_id and service_id', () => {
    expect(source).toContain('UUID_REGEX');
    expect(source).toMatch(/UUID_REGEX\.test\(professional_id\)/);
    expect(source).toMatch(/UUID_REGEX\.test\(service_id\)/);
  });

  it('returns 400 for invalid UUIDs', () => {
    // Check there's a 400 response for invalid IDs
    expect(source).toContain("'IDs inválidos'");
  });
});

describe('create-intent Stripe Connect verification (issue #183)', () => {
  it('checks charges_enabled from stripe_connect_accounts', () => {
    expect(source).toContain("from('stripe_connect_accounts')");
    expect(source).toContain('charges_enabled');
  });

  it('rejects if charges not enabled', () => {
    expect(source).toContain('!connectAccount?.charges_enabled');
  });
});

describe('create-intent amount validation (issue #183)', () => {
  it('calculates deposit server-side using calculateDeposit', () => {
    expect(source).toContain('calculateDeposit(');
    expect(source).toContain("import { calculateDeposit, toCents } from '@/lib/payment/calculate-deposit'");
  });

  it('does not accept amount from request body', () => {
    // The body destructuring should not include amount
    const bodyDestructure = source.slice(
      source.indexOf('const {'),
      source.indexOf('} = body as')
    );
    expect(bodyDestructure).not.toContain('amount');
  });

  it('uses toCents for Stripe amount conversion', () => {
    expect(source).toContain('toCents(depositAmount)');
  });

  it('rejects deposit amount <= 0', () => {
    expect(source).toContain('depositAmount <= 0');
  });
});

describe('create-intent service ownership (issue #183)', () => {
  it('verifies service belongs to professional', () => {
    // The services query must filter by both service_id AND professional_id
    const servicesQuery = source.slice(source.indexOf(".from('services')"));
    expect(servicesQuery).toContain(".eq('id', service_id)");
    expect(servicesQuery).toContain(".eq('professional_id', professional_id)");
  });
});

describe('create-intent does not leak sensitive info', () => {
  it('does not expose raw Stripe errors to client', () => {
    // Error responses should use generic messages, not raw err.message
    expect(source).not.toContain('err.message');
    expect(source).not.toContain('error.message');
  });

  it('logs errors server-side', () => {
    expect(source).toContain("logger.error('[payment/create-intent]'");
  });
});
