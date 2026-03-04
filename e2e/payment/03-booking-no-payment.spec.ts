/**
 * E2E: Fluxo de agendamento SEM sinal de reserva
 *
 * Cenários:
 *   A. Agendamento direto sem pagamento (API)
 *   B. Componentes de pagamento ausentes na página pública
 *   C. Estrutura da página de agendamento
 *
 * Usa o profissional de teste permanente (Rita) sem sinal habilitado.
 * Para cenários que criam profissional efémero, usa /api/test/setup-professional.
 */

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { TEST } from '../helpers/config';

const BASE = TEST.BASE_URL;

// ─── A. API de agendamento sem sinal ─────────────────────────────────────────

test.describe('Booking API sem sinal', () => {
  let professionalId: string;
  let serviceId: string;

  test.beforeAll(async () => {
    if (!TEST.SUPABASE_URL || !TEST.SUPABASE_SERVICE_KEY) return;

    const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);

    // Garantir require_deposit=false no profissional de teste
    await supabase
      .from('professionals')
      .update({ require_deposit: false, deposit_type: null, deposit_value: null })
      .eq('id', TEST.PROFESSIONAL_ID);

    professionalId = TEST.PROFESSIONAL_ID;

    const { data: services } = await supabase
      .from('services')
      .select('id')
      .eq('professional_id', professionalId)
      .eq('is_active', true)
      .limit(1);

    serviceId = services?.[0]?.id ?? '';
  });

  test('POST /api/bookings cria agendamento com status confirmed', async ({ request }) => {
    if (!serviceId) {
      test.skip();
      return;
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    const res = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: professionalId,
        service_id: serviceId,
        booking_date: dateStr,
        start_time: '10:00',
        client_name: 'Teste E2E No Payment',
        client_phone: '353800099001',
        client_email: `no-payment-${Date.now()}@test.com`,
      },
    });

    // 201 = criado, 409 = slot ocupado (ambos aceitáveis em CI)
    expect([201, 409]).toContain(res.status());

    if (res.status() === 201) {
      const data = await res.json();
      expect(data.booking).toHaveProperty('id');
      expect(data.booking.status).toBe('confirmed');

      // Cleanup
      if (TEST.SUPABASE_URL && TEST.SUPABASE_SERVICE_KEY) {
        const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);
        await supabase.from('bookings').delete().eq('id', data.booking.id);
      }
    }
  });

  test('POST /api/bookings retorna 400 com campos obrigatórios ausentes', async ({ request }) => {
    const res = await request.post(`${BASE}/api/bookings`, {
      data: { professional_id: professionalId },
    });
    expect(res.status()).toBe(400);
  });
});

// ─── B. Página pública — sem deposit-info ────────────────────────────────────

test.describe('Página pública sem sinal', () => {
  let slug: string;
  let professionalId: string;
  let cleanupId: string;

  test.beforeAll(async ({ request }) => {
    // Criar profissional efémero via test API (apenas em dev/test)
    const res = await request.post(`${BASE}/api/test/setup-professional`, {
      headers: { 'x-test-secret': TEST.E2E_TEST_SECRET },
      data: {
        name: 'Ana Sem Sinal',
        email: `ana-no-deposit-${Date.now()}@test.com`,
        requireDeposit: false,
        depositAmount: 0,
        services: [{ name: 'Manicure', duration: 45, price: 3000 }],
      },
    });

    if (!res.ok()) {
      // Em produção a rota é bloqueada — pular testes de criação efémera
      test.skip();
      return;
    }

    const data = await res.json();
    slug = data.slug;
    professionalId = data.professionalId;
    cleanupId = data.professionalId;
  });

  test.afterAll(async ({ request }) => {
    if (cleanupId) {
      await request.delete(`${BASE}/api/test/cleanup-professional/${cleanupId}`, {
        headers: { 'x-test-secret': TEST.E2E_TEST_SECRET },
      });
    }
  });

  test('deposit-info NÃO é visível na página de agendamento', async ({ page }) => {
    if (!slug) {
      test.skip();
      return;
    }

    await page.goto(`${BASE}/${slug}`);
    await expect(page.locator('h1, [data-testid="page-title"]').first()).toBeVisible({ timeout: 15000 });

    const depositInfo = page.locator('[data-testid="deposit-info"]');
    await expect(depositInfo).not.toBeVisible();
  });

  test('payment-section NÃO está visível na step inicial', async ({ page }) => {
    if (!slug) {
      test.skip();
      return;
    }

    await page.goto(`${BASE}/${slug}`);

    const paymentSection = page.locator('[data-testid="payment-section"]');
    await expect(paymentSection).not.toBeVisible();
  });

  test('serviços são listados com data-service-id', async ({ page }) => {
    if (!slug) {
      test.skip();
      return;
    }

    await page.goto(`${BASE}/${slug}`);
    await expect(page.locator('h1, [data-testid="page-title"]').first()).toBeVisible({ timeout: 15000 });

    const serviceCards = page.locator('[data-service-id]');
    await expect(serviceCards.first()).toBeVisible({ timeout: 10000 });
  });

  test('botão confirmar-agendamento aparece após selecionar serviço e horário', async ({ page }) => {
    if (!slug) {
      test.skip();
      return;
    }

    await page.goto(`${BASE}/${slug}`);
    await expect(page.locator('[data-service-id]').first()).toBeVisible({ timeout: 15000 });

    // Step 1: selecionar serviço
    await page.locator('[data-service-id]').first().click();

    // Step 2: selecionar data (amanhã)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    await expect(page.locator('[data-testid="date-picker"]')).toBeVisible({ timeout: 10000 });
    await page.locator(`[data-date="${dateStr}"]`).click().catch(async () => {
      // Se não há atributo data-date, clicar no primeiro dia disponível do calendário
      await page.locator('button[name]:not([disabled])').first().click();
    });

    // Step 3: selecionar horário
    const slot = page.locator('[data-testid="available-slot"]').first();
    await expect(slot).toBeVisible({ timeout: 10000 });
    await slot.click();

    // Step 4: confirmar botão visível
    const confirmBtn = page.locator('[data-testid="confirm-booking"]');
    await expect(confirmBtn).toBeVisible({ timeout: 10000 });
    await expect(confirmBtn).toContainText(/confirmar agendamento/i);
  });
});

// ─── C. Estrutura da página pública Rita ─────────────────────────────────────

test.describe('Estrutura da página de agendamento', () => {
  const PROF_EMAIL = TEST.USER_EMAIL;

  test('data-service-id presente em serviços do profissional Rita', async ({ page }) => {
    if (!TEST.SUPABASE_URL || !TEST.SUPABASE_SERVICE_KEY) {
      test.skip();
      return;
    }

    const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);
    const { data: prof } = await supabase
      .from('professionals')
      .select('slug')
      .eq('id', TEST.PROFESSIONAL_ID)
      .single();

    if (!prof?.slug) {
      test.skip();
      return;
    }

    await page.goto(`${BASE}/${prof.slug}`);
    await expect(page.locator('[data-service-id]').first()).toBeVisible({ timeout: 15000 });
  });
});
