import { describe, it, expect } from 'vitest';
import { COUNTRY_CODES, CATEGORY_KEYS, CURRENCY_BY_COUNTRY, LEGACY_CATEGORY_MAP } from '@/lib/auth-constants';

// ─── COUNTRY_CODES ──────────────────────────────────────────────────────────

describe('COUNTRY_CODES', () => {
  it('é um array não-vazio', () => {
    expect(COUNTRY_CODES.length).toBeGreaterThan(0);
  });

  it('cada código tem 2 letras maiúsculas', () => {
    for (const code of COUNTRY_CODES) {
      expect(code).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('não tem codes duplicados', () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
  });

  it('contém os países principais (IE, PT, BR)', () => {
    expect(COUNTRY_CODES).toContain('IE');
    expect(COUNTRY_CODES).toContain('PT');
    expect(COUNTRY_CODES).toContain('BR');
  });
});

// ─── CATEGORY_KEYS ──────────────────────────────────────────────────────────

describe('CATEGORY_KEYS', () => {
  it('é um array não-vazio', () => {
    expect(CATEGORY_KEYS.length).toBeGreaterThan(0);
  });

  it('não tem duplicados', () => {
    expect(new Set(CATEGORY_KEYS).size).toBe(CATEGORY_KEYS.length);
  });

  it('contém "other" como opção genérica', () => {
    expect(CATEGORY_KEYS).toContain('other');
  });

  it('todas são strings não-vazias em camelCase', () => {
    for (const key of CATEGORY_KEYS) {
      expect(typeof key).toBe('string');
      expect(key.length).toBeGreaterThan(0);
      expect(key).toMatch(/^[a-zA-Z]+$/);
    }
  });
});

// ─── LEGACY_CATEGORY_MAP ────────────────────────────────────────────────────

describe('LEGACY_CATEGORY_MAP', () => {
  it('mapeia cada CATEGORY_KEY de volta', () => {
    const mappedKeys = new Set(Object.values(LEGACY_CATEGORY_MAP));
    for (const key of CATEGORY_KEYS) {
      expect(mappedKeys).toContain(key);
    }
  });
});

// ─── CURRENCY_BY_COUNTRY ─────────────────────────────────────────────────────

describe('CURRENCY_BY_COUNTRY', () => {
  it('cada país em COUNTRY_CODES tem uma moeda mapeada', () => {
    for (const code of COUNTRY_CODES) {
      expect(CURRENCY_BY_COUNTRY[code]).toBeDefined();
      expect(CURRENCY_BY_COUNTRY[code].length).toBe(3);
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
