import { describe, it, expect } from 'vitest';
import { COUNTRIES, CATEGORIES, CURRENCY_BY_COUNTRY } from '@/lib/auth-constants';

// ─── COUNTRIES ────────────────────────────────────────────────────────────────

describe('COUNTRIES', () => {
  it('é um array não-vazio', () => {
    expect(COUNTRIES.length).toBeGreaterThan(0);
  });

  it('cada país tem code (2 chars) e label (string)', () => {
    for (const c of COUNTRIES) {
      expect(c.code).toMatch(/^[A-Z]{2}$/);
      expect(c.label.length).toBeGreaterThan(0);
    }
  });

  it('não tem codes duplicados', () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('contém os países principais (IE, PT, BR)', () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(codes).toContain('IE');
    expect(codes).toContain('PT');
    expect(codes).toContain('BR');
  });
});

// ─── CATEGORIES ───────────────────────────────────────────────────────────────

describe('CATEGORIES', () => {
  it('é um array não-vazio', () => {
    expect(CATEGORIES.length).toBeGreaterThan(0);
  });

  it('não tem duplicados', () => {
    expect(new Set(CATEGORIES).size).toBe(CATEGORIES.length);
  });

  it('contém "Outro" como opção genérica', () => {
    expect(CATEGORIES).toContain('Outro');
  });

  it('todas são strings não-vazias', () => {
    for (const cat of CATEGORIES) {
      expect(typeof cat).toBe('string');
      expect(cat.length).toBeGreaterThan(0);
    }
  });
});

// ─── CURRENCY_BY_COUNTRY ─────────────────────────────────────────────────────

describe('CURRENCY_BY_COUNTRY', () => {
  it('cada país em COUNTRIES tem uma moeda mapeada', () => {
    for (const c of COUNTRIES) {
      expect(CURRENCY_BY_COUNTRY[c.code]).toBeDefined();
      expect(CURRENCY_BY_COUNTRY[c.code].length).toBe(3);
    }
  });

  it('IE retorna eur', () => {
    expect(CURRENCY_BY_COUNTRY['IE']).toBe('eur');
  });

  it('BR retorna brl', () => {
    expect(CURRENCY_BY_COUNTRY['BR']).toBe('brl');
  });

  it('US retorna usd', () => {
    expect(CURRENCY_BY_COUNTRY['US']).toBe('usd');
  });

  it('GB retorna gbp', () => {
    expect(CURRENCY_BY_COUNTRY['GB']).toBe('gbp');
  });

  it('todas as moedas são strings de 3 caracteres lowercase', () => {
    for (const [, currency] of Object.entries(CURRENCY_BY_COUNTRY)) {
      expect(currency).toMatch(/^[a-z]{3}$/);
    }
  });
});
