import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Reproduz o schema exato de /api/auth/complete-profile/route.ts
// para testar isoladamente (sem importar o route handler do Next.js)
const bodySchema = z.object({
  business_name: z.string().min(1).max(100),
  slug: z.string().min(3).max(60).regex(/^[a-z0-9-]+$/),
  city: z.string().min(1).max(100),
  country: z.string().length(2),
  category: z.string().max(100).nullable().optional(),
  currency: z.string().min(3).max(3).default('eur'),
  locale: z.string().max(10).default('pt-BR'),
});

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('complete-profile schema — dados válidos', () => {
  it('aceita dados completos', () => {
    const result = bodySchema.safeParse({
      business_name: "Maria's Nails",
      slug: 'marias-nails',
      city: 'Dublin',
      country: 'IE',
      category: 'Nail Tech',
      currency: 'eur',
      locale: 'pt-BR',
    });
    expect(result.success).toBe(true);
  });

  it('aceita dados mínimos (category null, defaults aplicados)', () => {
    const result = bodySchema.safeParse({
      business_name: 'Teste',
      slug: 'tes',
      city: 'X',
      country: 'BR',
      category: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.currency).toBe('eur');
      expect(result.data.locale).toBe('pt-BR');
    }
  });

  it('aceita category omitido (optional)', () => {
    const result = bodySchema.safeParse({
      business_name: 'Teste',
      slug: 'teste-slug',
      city: 'Dublin',
      country: 'IE',
    });
    expect(result.success).toBe(true);
  });
});

// ─── business_name ────────────────────────────────────────────────────────────

describe('complete-profile schema — business_name', () => {
  it('rejeita string vazia', () => {
    const result = bodySchema.safeParse({
      business_name: '',
      slug: 'teste',
      city: 'Dublin',
      country: 'IE',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita > 100 chars', () => {
    const result = bodySchema.safeParse({
      business_name: 'A'.repeat(101),
      slug: 'teste',
      city: 'Dublin',
      country: 'IE',
    });
    expect(result.success).toBe(false);
  });
});

// ─── slug ─────────────────────────────────────────────────────────────────────

describe('complete-profile schema — slug', () => {
  it('rejeita slug com < 3 chars', () => {
    const result = bodySchema.safeParse({
      business_name: 'Teste',
      slug: 'ab',
      city: 'Dublin',
      country: 'IE',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita slug com caracteres inválidos (uppercase)', () => {
    const result = bodySchema.safeParse({
      business_name: 'Teste',
      slug: 'Maria-Nails',
      city: 'Dublin',
      country: 'IE',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita slug com espaços', () => {
    const result = bodySchema.safeParse({
      business_name: 'Teste',
      slug: 'maria nails',
      city: 'Dublin',
      country: 'IE',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita slug com acentos', () => {
    const result = bodySchema.safeParse({
      business_name: 'Teste',
      slug: 'maría-nails',
      city: 'Dublin',
      country: 'IE',
    });
    expect(result.success).toBe(false);
  });

  it('aceita slug com hífens e números', () => {
    const result = bodySchema.safeParse({
      business_name: 'Teste',
      slug: 'maria-nails-123',
      city: 'Dublin',
      country: 'IE',
    });
    expect(result.success).toBe(true);
  });
});

// ─── country ──────────────────────────────────────────────────────────────────

describe('complete-profile schema — country', () => {
  it('rejeita country com 1 char', () => {
    const result = bodySchema.safeParse({
      business_name: 'Teste',
      slug: 'teste',
      city: 'Dublin',
      country: 'I',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita country com 3 chars', () => {
    const result = bodySchema.safeParse({
      business_name: 'Teste',
      slug: 'teste',
      city: 'Dublin',
      country: 'IRL',
    });
    expect(result.success).toBe(false);
  });
});

// ─── currency ─────────────────────────────────────────────────────────────────

describe('complete-profile schema — currency', () => {
  it('rejeita currency com 2 chars', () => {
    const result = bodySchema.safeParse({
      business_name: 'Teste',
      slug: 'teste',
      city: 'Dublin',
      country: 'IE',
      currency: 'eu',
    });
    expect(result.success).toBe(false);
  });

  it('rejeita currency com 4 chars', () => {
    const result = bodySchema.safeParse({
      business_name: 'Teste',
      slug: 'teste',
      city: 'Dublin',
      country: 'IE',
      currency: 'euro',
    });
    expect(result.success).toBe(false);
  });
});
