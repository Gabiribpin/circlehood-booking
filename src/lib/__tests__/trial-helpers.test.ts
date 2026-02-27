import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock do Supabase admin client ANTES de importar o módulo
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

// Mock de business-days (funções puras são testadas no próprio módulo)
vi.mock('@/lib/business-days', () => ({
  hasPassedBusinessDays: vi.fn(),
}));

import { createAdminClient } from '@/lib/supabase/admin';
import { hasPassedBusinessDays } from '@/lib/business-days';
import {
  getTrialStatusById,
  isPublicPageAvailable,
  calculateTrialEndDate,
} from '@/lib/trial-helpers';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockSupabase(data: Record<string, unknown> | null) {
  const single = vi.fn().mockResolvedValue({ data, error: null });
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle, single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({ from });
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

// ─── calculateTrialEndDate ────────────────────────────────────────────────────

describe('calculateTrialEndDate', () => {
  it('retorna data 14 dias no futuro por padrão', () => {
    const result = calculateTrialEndDate();
    const diff = result.getTime() - Date.now();
    const days = diff / (1000 * 60 * 60 * 24);
    expect(days).toBeGreaterThan(13.9);
    expect(days).toBeLessThan(14.1);
  });

  it('aceita número de dias personalizado', () => {
    const result = calculateTrialEndDate(30);
    const diff = result.getTime() - Date.now();
    const days = diff / (1000 * 60 * 60 * 24);
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThan(30.1);
  });

  it('retorna instância de Date', () => {
    expect(calculateTrialEndDate()).toBeInstanceOf(Date);
  });
});

// ─── getTrialStatusById ───────────────────────────────────────────────────────

describe('getTrialStatusById — profissional não encontrado', () => {
  beforeEach(() => mockSupabase(null));

  it('retorna null quando profissional não existe', async () => {
    const result = await getTrialStatusById('non-existent-id');
    expect(result).toBeNull();
  });
});

describe('getTrialStatusById — plano não-trial (active)', () => {
  beforeEach(() =>
    mockSupabase({ subscription_status: 'active', trial_ends_at: null })
  );

  it('isActive = false quando plano é active (não trial)', async () => {
    const result = await getTrialStatusById('some-id');
    expect(result?.isActive).toBe(false);
    expect(result?.hasExpired).toBe(false);
    expect(result?.daysRemaining).toBe(0);
  });
});

describe('getTrialStatusById — trial ativo', () => {
  beforeEach(() =>
    mockSupabase({ subscription_status: 'trial', trial_ends_at: daysFromNow(7) })
  );

  it('isActive = true quando trial não expirou', async () => {
    const result = await getTrialStatusById('some-id');
    expect(result?.isActive).toBe(true);
    expect(result?.hasExpired).toBe(false);
  });

  it('daysRemaining > 0 quando trial ativo', async () => {
    const result = await getTrialStatusById('some-id');
    expect(result?.daysRemaining).toBeGreaterThan(0);
  });

  it('trialEndDate é uma instância de Date', async () => {
    const result = await getTrialStatusById('some-id');
    expect(result?.trialEndDate).toBeInstanceOf(Date);
  });
});

describe('getTrialStatusById — trial expirado', () => {
  beforeEach(() =>
    mockSupabase({ subscription_status: 'trial', trial_ends_at: daysFromNow(-3) })
  );

  it('isActive = false quando trial expirado', async () => {
    const result = await getTrialStatusById('some-id');
    expect(result?.isActive).toBe(false);
    expect(result?.hasExpired).toBe(true);
  });

  it('daysRemaining = 0 quando trial expirado', async () => {
    const result = await getTrialStatusById('some-id');
    expect(result?.daysRemaining).toBe(0);
  });
});

describe('getTrialStatusById — trial sem trial_ends_at', () => {
  beforeEach(() =>
    mockSupabase({ subscription_status: 'trial', trial_ends_at: null })
  );

  it('isActive = false quando trial_ends_at é null', async () => {
    const result = await getTrialStatusById('some-id');
    expect(result?.isActive).toBe(false);
  });
});

// ─── isPublicPageAvailable ────────────────────────────────────────────────────

describe('isPublicPageAvailable — profissional não encontrado', () => {
  beforeEach(() => mockSupabase(null));

  it('retorna not_found', async () => {
    const result = await isPublicPageAvailable('non-existent');
    expect(result.available).toBe(false);
    expect(result.reason).toBe('not_found');
  });
});

describe('isPublicPageAvailable — conta deletada', () => {
  beforeEach(() =>
    mockSupabase({
      subscription_status: 'active',
      trial_ends_at: null,
      is_active: true,
      deleted_at: new Date().toISOString(),
      payment_failed_at: null,
    })
  );

  it('retorna not_found quando deleted_at está definido', async () => {
    const result = await isPublicPageAvailable('some-id');
    expect(result.available).toBe(false);
    expect(result.reason).toBe('not_found');
  });
});

describe('isPublicPageAvailable — desativado manualmente', () => {
  beforeEach(() =>
    mockSupabase({
      subscription_status: 'active',
      trial_ends_at: null,
      is_active: false,
      deleted_at: null,
      payment_failed_at: null,
    })
  );

  it('retorna manually_disabled quando is_active = false', async () => {
    const result = await isPublicPageAvailable('some-id');
    expect(result.available).toBe(false);
    expect(result.reason).toBe('manually_disabled');
  });
});

describe('isPublicPageAvailable — plano active, pagamento OK', () => {
  beforeEach(() => {
    mockSupabase({
      subscription_status: 'active',
      trial_ends_at: null,
      is_active: true,
      deleted_at: null,
      payment_failed_at: null,
    });
    (hasPassedBusinessDays as ReturnType<typeof vi.fn>).mockReturnValue(false);
  });

  it('retorna available = true quando pagamento OK', async () => {
    const result = await isPublicPageAvailable('some-id');
    expect(result.available).toBe(true);
  });
});

describe('isPublicPageAvailable — pagamento falhou + 5 dias úteis passados', () => {
  beforeEach(() => {
    mockSupabase({
      subscription_status: 'active',
      trial_ends_at: null,
      is_active: true,
      deleted_at: null,
      payment_failed_at: daysFromNow(-6),
    });
    (hasPassedBusinessDays as ReturnType<typeof vi.fn>).mockReturnValue(true);
  });

  it('retorna payment_failed quando 5 dias úteis passaram', async () => {
    const result = await isPublicPageAvailable('some-id');
    expect(result.available).toBe(false);
    expect(result.reason).toBe('payment_failed');
  });
});

describe('isPublicPageAvailable — pagamento falhou mas dentro do prazo', () => {
  beforeEach(() => {
    mockSupabase({
      subscription_status: 'active',
      trial_ends_at: null,
      is_active: true,
      deleted_at: null,
      payment_failed_at: daysFromNow(-1),
    });
    (hasPassedBusinessDays as ReturnType<typeof vi.fn>).mockReturnValue(false);
  });

  it('retorna available = true dentro do período de graça', async () => {
    const result = await isPublicPageAvailable('some-id');
    expect(result.available).toBe(true);
  });
});

describe('isPublicPageAvailable — trial ativo', () => {
  beforeEach(() =>
    mockSupabase({
      subscription_status: 'trial',
      trial_ends_at: daysFromNow(5),
      is_active: true,
      deleted_at: null,
      payment_failed_at: null,
    })
  );

  it('retorna available = true quando trial não expirou', async () => {
    const result = await isPublicPageAvailable('some-id');
    expect(result.available).toBe(true);
  });
});

describe('isPublicPageAvailable — trial expirado', () => {
  beforeEach(() =>
    mockSupabase({
      subscription_status: 'trial',
      trial_ends_at: daysFromNow(-1),
      is_active: true,
      deleted_at: null,
      payment_failed_at: null,
    })
  );

  it('retorna trial_expired quando trial venceu', async () => {
    const result = await isPublicPageAvailable('some-id');
    expect(result.available).toBe(false);
    expect(result.reason).toBe('trial_expired');
  });
});

describe('isPublicPageAvailable — trial sem data de fim', () => {
  beforeEach(() =>
    mockSupabase({
      subscription_status: 'trial',
      trial_ends_at: null,
      is_active: true,
      deleted_at: null,
      payment_failed_at: null,
    })
  );

  it('retorna trial_expired quando trial_ends_at é null', async () => {
    const result = await isPublicPageAvailable('some-id');
    expect(result.available).toBe(false);
    expect(result.reason).toBe('trial_expired');
  });
});
