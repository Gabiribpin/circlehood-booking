import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const SLUG_PAGE = path.resolve(__dirname, '../../app/[locale]/(public)/[slug]/page.tsx');
const SETTINGS_PAGE = path.resolve(__dirname, '../../app/[locale]/(dashboard)/settings/page.tsx');
const PT_BR = path.resolve(__dirname, '../../../messages/pt-BR.json');
const EN_US = path.resolve(__dirname, '../../../messages/en-US.json');
const ES_ES = path.resolve(__dirname, '../../../messages/es-ES.json');

describe('[slug]/page.tsx — deposit blocked until Stripe Connect verified', () => {
  const content = fs.readFileSync(SLUG_PAGE, 'utf-8');

  it('queries stripe_connect_accounts for charges_enabled', () => {
    expect(content).toContain("from('stripe_connect_accounts')");
    expect(content).toContain("select('charges_enabled')");
  });

  it('computes stripeChargesEnabled from charges_enabled', () => {
    expect(content).toContain('connectAccount?.charges_enabled === true');
  });

  it('computes depositReady as require_deposit AND stripeChargesEnabled', () => {
    expect(content).toContain('depositReady');
    expect(content).toMatch(/require_deposit.*&&.*stripeChargesEnabled/);
  });

  it('passes depositReady to BookingSection (not raw require_deposit)', () => {
    // Both BookingSection instances should use depositReady
    const matches = content.match(/requireDeposit=\{depositReady\}/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(2);
  });

  it('does NOT pass raw require_deposit to any BookingSection', () => {
    expect(content).not.toContain('requireDeposit={professional.require_deposit');
  });
});

describe('settings/page.tsx — stripeConnected from DB (unified settings)', () => {
  const content = fs.readFileSync(SETTINGS_PAGE, 'utf-8');

  it('queries stripe_connect_accounts for charges_enabled', () => {
    expect(content).toContain("from('stripe_connect_accounts')");
    expect(content).toContain("select('charges_enabled')");
  });

  it('computes stripeConnected from charges_enabled (not hardcoded)', () => {
    expect(content).toContain('connectAccount?.charges_enabled === true');
  });
});

describe('translations — Stripe onboarding time estimate', () => {
  const ptBR = JSON.parse(fs.readFileSync(PT_BR, 'utf-8'));
  const enUS = JSON.parse(fs.readFileSync(EN_US, 'utf-8'));
  const esES = JSON.parse(fs.readFileSync(ES_ES, 'utf-8'));

  it('pt-BR setupSavedStripe includes time estimate', () => {
    expect(ptBR.payment.setupSavedStripe).toContain('1-2 dias úteis');
    expect(ptBR.payment.setupSavedStripe).toContain('sinal será ativado');
  });

  it('en-US setupSavedStripe includes time estimate', () => {
    expect(enUS.payment.setupSavedStripe).toContain('1-2 business days');
    expect(enUS.payment.setupSavedStripe).toContain('Deposits will be activated');
  });

  it('es-ES setupSavedStripe includes time estimate', () => {
    expect(esES.payment.setupSavedStripe).toContain('1-2 días hábiles');
    expect(esES.payment.setupSavedStripe).toContain('seña se activará');
  });

  it('pt-BR setupSuccessStripe includes time estimate', () => {
    expect(ptBR.payment.setupSuccessStripe).toContain('1-2 dias úteis');
  });

  it('en-US setupSuccessStripe includes time estimate', () => {
    expect(enUS.payment.setupSuccessStripe).toContain('1-2 business days');
  });

  it('es-ES setupSuccessStripe includes time estimate', () => {
    expect(esES.payment.setupSuccessStripe).toContain('1-2 días hábiles');
  });

  it('all 3 locales have matching setupSavedStripe key', () => {
    expect(ptBR.payment.setupSavedStripe).toBeDefined();
    expect(enUS.payment.setupSavedStripe).toBeDefined();
    expect(esES.payment.setupSavedStripe).toBeDefined();
  });
});
