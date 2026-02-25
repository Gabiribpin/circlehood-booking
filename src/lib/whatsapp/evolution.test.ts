import { describe, it, expect } from 'vitest';
import { normalizePhoneForWhatsApp } from './evolution';

describe('normalizePhoneForWhatsApp', () => {
  // ─── Casos do enunciado ───────────────────────────────────────────────────

  it('Irlanda: +353 083 032 6180 → 353830326180', () => {
    expect(normalizePhoneForWhatsApp('+353 083 032 6180')).toBe('353830326180');
  });

  it('Brasil: +55 11 96609-8544 → 5511966098544', () => {
    expect(normalizePhoneForWhatsApp('+55 11 96609-8544')).toBe('5511966098544');
  });

  it('UK: +44 07911 123456 → 447911123456', () => {
    expect(normalizePhoneForWhatsApp('+44 07911 123456')).toBe('447911123456');
  });

  it('já correto: 353830326180 → 353830326180 (sem alteração)', () => {
    expect(normalizePhoneForWhatsApp('353830326180')).toBe('353830326180');
  });

  it('Portugal: +351 912 345 678 → 351912345678 (sem trunk prefix)', () => {
    expect(normalizePhoneForWhatsApp('+351 912 345 678')).toBe('351912345678');
  });

  // ─── Casos adicionais ─────────────────────────────────────────────────────

  it('Irlanda com hífens: +353-083-032-6180 → 353830326180', () => {
    expect(normalizePhoneForWhatsApp('+353-083-032-6180')).toBe('353830326180');
  });

  it('Irlanda sem +: 353083032618 → 35383032618', () => {
    expect(normalizePhoneForWhatsApp('353083032618')).toBe('35383032618');
  });

  it('Brasil com trunk raro: +55 011 96609-8544 → 5511966098544', () => {
    expect(normalizePhoneForWhatsApp('+55 011 96609-8544')).toBe('5511966098544');
  });

  it('Brasil sem 0: +55 11 96609-8544 permanece 5511966098544', () => {
    expect(normalizePhoneForWhatsApp('+55 11 96609-8544')).toBe('5511966098544');
  });

  it('Alemanha: +49 0171 1234567 → 491711234567', () => {
    expect(normalizePhoneForWhatsApp('+49 0171 1234567')).toBe('491711234567');
  });

  it('França: +33 06 12 34 56 78 → 33612345678', () => {
    expect(normalizePhoneForWhatsApp('+33 06 12 34 56 78')).toBe('33612345678');
  });

  it('número já normalizado sem prefixo: 5511966098544 → 5511966098544', () => {
    expect(normalizePhoneForWhatsApp('5511966098544')).toBe('5511966098544');
  });

  it('número com parênteses: (353) 083-032-6180 → 353830326180', () => {
    expect(normalizePhoneForWhatsApp('(353) 083-032-6180')).toBe('353830326180');
  });

  it('número vazio → string vazia', () => {
    expect(normalizePhoneForWhatsApp('')).toBe('');
  });

  it('só símbolos → string vazia', () => {
    expect(normalizePhoneForWhatsApp('+-() ')).toBe('');
  });
});
