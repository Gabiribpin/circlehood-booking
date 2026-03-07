import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const STRIPE_SERVER = path.resolve(__dirname, '../../lib/stripe/server.ts');
const CREATE_INTENT = path.resolve(__dirname, '../../app/api/payment/create-intent/route.ts');
const CHECKOUT = path.resolve(__dirname, '../../app/api/bookings/checkout/route.ts');

describe('Stripe server — maxNetworkRetries', () => {
  const content = fs.readFileSync(STRIPE_SERVER, 'utf-8');

  it('configures maxNetworkRetries', () => {
    expect(content).toContain('maxNetworkRetries');
  });

  it('sets maxNetworkRetries to at least 3', () => {
    const match = content.match(/maxNetworkRetries:\s*(\d+)/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBeGreaterThanOrEqual(3);
  });
});

describe('/api/payment/create-intent — error handling', () => {
  const content = fs.readFileSync(CREATE_INTENT, 'utf-8');

  it('does NOT expose raw Stripe SDK error messages to user', () => {
    // Must not return err.message directly
    expect(content).not.toMatch(/error:\s*message\b/);
    expect(content).not.toContain('err.message');
  });

  it('handles StripeConnectionError specifically', () => {
    expect(content).toContain('StripeConnectionError');
  });

  it('returns 502 for connection errors', () => {
    // Check that StripeConnectionError → 502
    const connectionBlock = content.slice(
      content.indexOf('StripeConnectionError'),
      content.indexOf('StripeConnectionError') + 200
    );
    expect(connectionBlock).toContain('502');
  });

  it('returns user-friendly error message for connection failures', () => {
    expect(content).toContain('Conexão temporariamente indisponível');
  });

  it('returns generic safe message for other errors', () => {
    expect(content).toContain('Erro ao processar pagamento. Tente novamente.');
  });

  it('imports and uses logger', () => {
    expect(content).toContain("import { logger } from '@/lib/logger'");
    expect(content).toContain("logger.error('[payment/create-intent]'");
  });
});

describe('/api/bookings/checkout — error handling', () => {
  const content = fs.readFileSync(CHECKOUT, 'utf-8');

  it('imports logger', () => {
    expect(content).toContain("import { logger } from '@/lib/logger'");
  });

  it('logs Stripe session creation failures', () => {
    expect(content).toContain('[bookings/checkout] Stripe session creation failed');
  });

  it('returns user-friendly error with retry suggestion', () => {
    expect(content).toContain('Tente novamente');
  });

  it('rolls back booking on Stripe failure', () => {
    // After the Stripe session catch, it should cancel the booking
    const catchBlock = content.slice(
      content.indexOf("Stripe session creation failed"),
      content.indexOf("Stripe session creation failed") + 300
    );
    expect(catchBlock).toContain("status: 'cancelled'");
  });
});
