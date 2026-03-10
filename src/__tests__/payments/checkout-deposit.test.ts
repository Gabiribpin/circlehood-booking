import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { calculateDeposit, toCents } from '@/lib/payment/calculate-deposit';

describe('calculateDeposit', () => {
  it('calcula percentagem corretamente', () => {
    expect(calculateDeposit(100, 'percentage', 30)).toBe(30);
    expect(calculateDeposit(50, 'percentage', 20)).toBe(10);
    expect(calculateDeposit(75, 'percentage', 10)).toBe(7.5);
  });

  it('retorna valor fixo corretamente', () => {
    expect(calculateDeposit(100, 'fixed', 25)).toBe(25);
    expect(calculateDeposit(50, 'fixed', 10)).toBe(10);
  });

  it('arredonda para 2 casas decimais', () => {
    expect(calculateDeposit(33, 'percentage', 33)).toBe(10.89);
    expect(calculateDeposit(99.99, 'fixed', 0.01)).toBe(0.01);
  });
});

describe('toCents', () => {
  it('converte para centavos corretamente', () => {
    expect(toCents(10)).toBe(1000);
    expect(toCents(25.5)).toBe(2550);
    expect(toCents(0.01)).toBe(1);
  });
});

describe('application_fee 5%', () => {
  it('calcula taxa da plataforma corretamente', () => {
    // Para um serviço de €100 com sinal de 30% (€30) → taxa = €1.50
    const depositAmount = calculateDeposit(100, 'percentage', 30);
    const depositCents = toCents(depositAmount);
    const applicationFee = Math.round(depositCents * 0.05);

    expect(depositCents).toBe(3000); // €30 em centavos
    expect(applicationFee).toBe(150); // €1.50 em centavos (5% de €30)
  });

  it('calcula taxa para valor fixo', () => {
    const depositAmount = calculateDeposit(80, 'fixed', 20);
    const depositCents = toCents(depositAmount);
    const applicationFee = Math.round(depositCents * 0.05);

    expect(depositCents).toBe(2000); // €20 em centavos
    expect(applicationFee).toBe(100); // €1.00 em centavos (5% de €20)
  });

  it('taxa mínima de 1 centavo para sinais pequenos', () => {
    const depositAmount = calculateDeposit(5, 'fixed', 1);
    const depositCents = toCents(depositAmount);
    const applicationFee = Math.round(depositCents * 0.05);

    expect(depositCents).toBe(100); // €1 em centavos
    expect(applicationFee).toBe(5); // 5 centavos (5% de €1)
  });
});

describe('checkout endpoint expires stale pending_payment before conflict check (issue #492)', () => {
  const checkoutSource = readFileSync(
    resolve('src/app/api/bookings/checkout/route.ts'),
    'utf-8',
  );
  const bookingsSource = readFileSync(
    resolve('src/app/api/bookings/route.ts'),
    'utf-8',
  );

  it('checkout has pending_payment expiration before conflict check', () => {
    const expirationIdx = checkoutSource.indexOf("'expired'");
    const conflictIdx = checkoutSource.indexOf('Check double-booking');
    expect(expirationIdx).toBeGreaterThan(-1);
    expect(conflictIdx).toBeGreaterThan(-1);
    expect(expirationIdx).toBeLessThan(conflictIdx);
  });

  it('checkout uses 30-minute cutoff like bookings route', () => {
    expect(checkoutSource).toContain('30 * 60 * 1000');
    expect(bookingsSource).toContain('30 * 60 * 1000');
  });

  it('checkout filters by pending_payment status and created_at', () => {
    expect(checkoutSource).toContain("'pending_payment'");
    expect(checkoutSource).toContain('paymentCutoff');
  });
});
