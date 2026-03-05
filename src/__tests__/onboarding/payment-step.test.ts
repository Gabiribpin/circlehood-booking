import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ONBOARDING_PAGE = path.resolve(
  __dirname,
  '../../app/[locale]/(dashboard)/onboarding/page.tsx'
);
const PT_BR = path.resolve(__dirname, '../../../messages/pt-BR.json');
const EN_US = path.resolve(__dirname, '../../../messages/en-US.json');
const ES_ES = path.resolve(__dirname, '../../../messages/es-ES.json');

describe('Onboarding — payment step exists', () => {
  const content = fs.readFileSync(ONBOARDING_PAGE, 'utf-8');

  it('defines a payment step in STEP_DEFS', () => {
    expect(content).toContain("id: 'payment'");
    expect(content).toContain("tKey: 'Payment'");
  });

  it('payment step links to /settings/payment', () => {
    expect(content).toContain("href: '/settings/payment'");
  });

  it('payment step is optional (not required)', () => {
    // Extract the payment step line
    const paymentLine = content
      .split('\n')
      .find((l) => l.includes("id: 'payment'"));
    expect(paymentLine).toBeDefined();
    expect(paymentLine).toContain('required: false');
  });

  it('imports CreditCard icon', () => {
    expect(content).toContain('CreditCard');
  });

  it('payment step uses CreditCard icon', () => {
    const paymentLine = content
      .split('\n')
      .find((l) => l.includes("id: 'payment'"));
    expect(paymentLine).toContain('CreditCard');
  });

  it('includes payment in initial completion state', () => {
    expect(content).toContain('payment: false');
  });

  it('checks payment_method in loadStatus', () => {
    expect(content).toContain('payment_method');
  });

  it('sets payment completion based on payment_method', () => {
    expect(content).toMatch(/payment:.*professional\.payment_method/);
  });
});

describe('Onboarding payment step — translations', () => {
  const ptBR = JSON.parse(fs.readFileSync(PT_BR, 'utf-8'));
  const enUS = JSON.parse(fs.readFileSync(EN_US, 'utf-8'));
  const esES = JSON.parse(fs.readFileSync(ES_ES, 'utf-8'));

  const keys = ['stepPaymentTitle', 'stepPaymentDesc', 'stepPaymentAction'];

  for (const key of keys) {
    it(`pt-BR has ${key}`, () => {
      expect(ptBR.onboarding[key]).toBeDefined();
      expect(ptBR.onboarding[key].length).toBeGreaterThan(0);
    });

    it(`en-US has ${key}`, () => {
      expect(enUS.onboarding[key]).toBeDefined();
      expect(enUS.onboarding[key].length).toBeGreaterThan(0);
    });

    it(`es-ES has ${key}`, () => {
      expect(esES.onboarding[key]).toBeDefined();
      expect(esES.onboarding[key].length).toBeGreaterThan(0);
    });
  }

  it('pt-BR description mentions processing time', () => {
    expect(ptBR.onboarding.stepPaymentDesc).toContain('1-2 dias úteis');
  });

  it('en-US description mentions processing time', () => {
    expect(enUS.onboarding.stepPaymentDesc).toContain('1-2 business days');
  });

  it('es-ES description mentions processing time', () => {
    expect(esES.onboarding.stepPaymentDesc).toContain('1-2 días hábiles');
  });

  it('pt-BR description mentions manual fallback', () => {
    expect(ptBR.onboarding.stepPaymentDesc).toContain('manual');
  });

  it('en-US description mentions manual fallback', () => {
    expect(enUS.onboarding.stepPaymentDesc).toContain('manual');
  });

  it('es-ES description mentions manual fallback', () => {
    expect(esES.onboarding.stepPaymentDesc).toContain('manual');
  });
});
