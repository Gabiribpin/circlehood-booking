import { describe, it, expect } from 'vitest';
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
