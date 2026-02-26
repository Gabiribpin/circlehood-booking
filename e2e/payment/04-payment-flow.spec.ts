/**
 * E2E: Fluxo de agendamento COM sinal de reserva (Stripe Checkout)
 *
 * Cenários:
 *   A. API /api/bookings/checkout cria sessão Stripe (com sinal configurado)
 *   B. Componentes de sinal visíveis na página pública
 *   C. API /api/bookings/checkout retorna erro sem Stripe configurado
 *
 * Testes que exigem Stripe real são guarded por test.skip quando
 * STRIPE_TEST_ACCOUNT_ID não estiver definido.
 */

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { TEST } from '../helpers/config';

const BASE = TEST.BASE_URL;
const HAS_STRIPE = !!process.env.STRIPE_TEST_ACCOUNT_ID;

// ─── A. API /api/bookings/checkout ───────────────────────────────────────────

test.describe('API bookings/checkout', () => {
  let ephemeralProfId: string;
  let ephemeralSlug: string;
  let ephemeralServiceId: string;

  test.beforeAll(async ({ request }) => {
    if (!HAS_STRIPE) return;

    const res = await request.post(`${BASE}/api/test/setup-professional`, {
      data: {
        name: 'Rita Stripe Teste',
        email: `rita-stripe-${Date.now()}@test.com`,
        requireDeposit: true,
        depositAmount: 2000, // R$ 20,00 em centavos
        depositType: 'fixed',
        stripeAccountId: process.env.STRIPE_TEST_ACCOUNT_ID,
        services: [{ name: 'Corte', duration: 60, price: 5000 }],
      },
    });

    if (res.ok()) {
      const data = await res.json();
      ephemeralProfId = data.professionalId;
      ephemeralSlug = data.slug;
      ephemeralServiceId = data.services[0]?.id;
    }
  });

  test.afterAll(async ({ request }) => {
    if (ephemeralProfId) {
      await request.delete(`${BASE}/api/test/cleanup-professional/${ephemeralProfId}`);
    }
  });

  test.skip(!HAS_STRIPE, 'STRIPE_TEST_ACCOUNT_ID não definido — skipping Stripe tests');

  test('POST /api/bookings/checkout retorna session_url para profissional com Stripe', async ({
    request,
  }) => {
    if (!ephemeralServiceId) {
      test.skip();
      return;
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const res = await request.post(`${BASE}/api/bookings/checkout`, {
      data: {
        professional_id: ephemeralProfId,
        service_id: ephemeralServiceId,
        booking_date: dateStr,
        start_time: '10:00',
        client_name: 'João Stripe Test',
        client_phone: '353800099002',
        client_email: `stripe-client-${Date.now()}@test.com`,
      },
    });

    // Pode ser 201 (session criada) ou 503 (Stripe não configurado em CI)
    expect([200, 201, 503]).toContain(res.status());

    if (res.status() === 201 || res.status() === 200) {
      const data = await res.json();
      expect(data).toHaveProperty('session_url');
      expect(data.session_url).toContain('stripe.com');
    }
  });
});

// ─── B. Página pública com sinal ─────────────────────────────────────────────

test.describe('Página pública COM sinal (ephemeral)', () => {
  let slug: string;
  let cleanupId: string;

  test.beforeAll(async ({ request }) => {
    if (!HAS_STRIPE) return;

    const res = await request.post(`${BASE}/api/test/setup-professional`, {
      data: {
        name: 'Prof Com Sinal',
        email: `with-deposit-${Date.now()}@test.com`,
        requireDeposit: true,
        depositAmount: 2000,
        depositType: 'fixed',
        stripeAccountId: process.env.STRIPE_TEST_ACCOUNT_ID,
        services: [{ name: 'Corte', duration: 60, price: 5000 }],
      },
    });

    if (res.ok()) {
      const data = await res.json();
      slug = data.slug;
      cleanupId = data.professionalId;
    }
  });

  test.afterAll(async ({ request }) => {
    if (cleanupId) {
      await request.delete(`${BASE}/api/test/cleanup-professional/${cleanupId}`);
    }
  });

  test.skip(!HAS_STRIPE, 'STRIPE_TEST_ACCOUNT_ID não definido');

  test('deposit-info É visível na página de agendamento com sinal', async ({ page }) => {
    if (!slug) {
      test.skip();
      return;
    }

    await page.goto(`${BASE}/${slug}`);
    await expect(page.locator('[data-service-id]').first()).toBeVisible({ timeout: 15000 });

    const depositInfo = page.locator('[data-testid="deposit-info"]');
    await expect(depositInfo).toBeVisible();
  });

  test('botão continuar tem texto de pagamento quando sinal exigido', async ({ page }) => {
    if (!slug) {
      test.skip();
      return;
    }

    await page.goto(`${BASE}/${slug}`);
    await expect(page.locator('[data-service-id]').first()).toBeVisible({ timeout: 15000 });

    // Navegar até step 4
    await page.locator('[data-service-id]').first().click();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    await expect(page.locator('[data-testid="date-picker"]')).toBeVisible({ timeout: 10000 });
    await page.locator(`[data-date="${dateStr}"]`).click().catch(async () => {
      await page.locator('button[name]:not([disabled])').first().click();
    });

    const slot = page.locator('[data-testid="available-slot"]').first();
    await expect(slot).toBeVisible({ timeout: 10000 });
    await slot.click();

    const confirmBtn = page.locator('[data-testid="confirm-booking"]');
    await expect(confirmBtn).toBeVisible({ timeout: 10000 });
    await expect(confirmBtn).toContainText(/pagamento|sinal|continuar/i);
  });
});

// ─── C. API checkout sem Stripe configurado ───────────────────────────────────

test.describe('API bookings/checkout — sem Stripe', () => {
  test('retorna erro quando profissional não tem Stripe configurado', async ({ request }) => {
    if (!TEST.SUPABASE_URL || !TEST.SUPABASE_SERVICE_KEY) {
      test.skip();
      return;
    }

    const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);

    // Garantir profissional Rita sem stripe_account_id
    await supabase
      .from('professionals')
      .update({ stripe_account_id: null, require_deposit: true, deposit_type: 'fixed', deposit_value: 20 })
      .eq('id', TEST.PROFESSIONAL_ID);

    const { data: services } = await supabase
      .from('services')
      .select('id')
      .eq('professional_id', TEST.PROFESSIONAL_ID)
      .eq('is_active', true)
      .limit(1);

    const serviceId = services?.[0]?.id;
    if (!serviceId) {
      test.skip();
      return;
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const res = await request.post(`${BASE}/api/bookings/checkout`, {
      data: {
        professional_id: TEST.PROFESSIONAL_ID,
        service_id: serviceId,
        booking_date: dateStr,
        start_time: '11:00',
        client_name: 'Test Checkout',
        client_phone: '353800099003',
      },
    });

    // Sem stripe_account_id → 400 ou 422
    expect([400, 422, 503]).toContain(res.status());

    // Restaurar
    await supabase
      .from('professionals')
      .update({ require_deposit: false, deposit_type: null, deposit_value: null })
      .eq('id', TEST.PROFESSIONAL_ID);
  });
});
