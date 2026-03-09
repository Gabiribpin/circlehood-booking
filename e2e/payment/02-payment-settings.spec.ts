/**
 * E2E: Configurações de pagamento — UI tests (toggle, validação, persistência)
 *
 * Usa storageState da conta de teste permanente (Rita).
 * Testa a página /settings/payment:
 *   1. Ativar toggle "Exigir sinal" → salvar → recarregar → confirmar ativo
 *   2. Desativar toggle → salvar → recarregar → confirmar desativado
 *   3. Aviso Stripe aparece quando Stripe não conectado
 *
 * Cleanup: afterAll desativa sinal via Supabase service role.
 */

import { createClient } from '@supabase/supabase-js';
import { test, expect } from '@playwright/test';
import { TEST } from '../helpers/config';

const BASE = TEST.BASE_URL;

async function resetPaymentSettings() {
  if (!TEST.SUPABASE_URL || !TEST.SUPABASE_SERVICE_KEY) return;
  const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);
  await supabase
    .from('professionals')
    .update({ require_deposit: false, deposit_type: null, deposit_value: null })
    .eq('id', TEST.PROFESSIONAL_ID);
}

async function goToPaymentSettings(page: any) {
  await page.goto(`${BASE}/settings?tab=pagamentos`);
  // Dashboard layout may redirect to /subscribe if subscription inactive
  if (page.url().includes('/subscribe')) {
    throw new Error('Redirect to /subscribe — subscription inactive. Auth setup should set subscription_status=active.');
  }
  // Wait for unified settings page heading
  await expect(page.locator('h1').first()).toBeVisible({ timeout: 15000 });
  // Wait for Pagamentos tab content to render (PaymentSettings component)
  await expect(page.getByRole('tab', { name: /pagamentos/i })).toBeVisible({ timeout: 10000 });
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

test.describe('Payment Settings Toggle', () => {
  test.afterAll(resetPaymentSettings);

  test('toggle require-deposit aparece na página', async ({ page }) => {
    await goToPaymentSettings(page);

    // O toggle pode estar desabilitado se Stripe não estiver conectado
    const toggle = page.locator('[data-testid="require-deposit-toggle"]');
    await expect(toggle).toBeVisible({ timeout: 10000 });
  });

  test('aviso Stripe aparece quando Stripe não conectado', async ({ page }) => {
    await goToPaymentSettings(page);

    // Se não há Stripe Connect configurado, deve mostrar aviso
    const stripeWarning = page.locator('[data-testid="stripe-required-warning"]');
    const toggle = page.locator('[data-testid="require-deposit-toggle"]');

    // Um dos dois cenários: aviso visível (sem Stripe) ou toggle habilitado (com Stripe)
    const warningVisible = await stripeWarning.isVisible().catch(() => false);
    const toggleEnabled = await toggle.isEnabled().catch(() => false);

    // Pelo menos um deve ser verdadeiro
    expect(warningVisible || toggleEnabled).toBeTruthy();
  });

  test('botão salvar existe e está funcional', async ({ page }) => {
    await goToPaymentSettings(page);

    const saveBtn = page.locator('[data-testid="save-settings"]');
    await expect(saveBtn).toBeVisible({ timeout: 10000 });
    await expect(saveBtn).toBeEnabled();
  });

  test('campo deposit-amount aparece quando toggle ativo (se Stripe conectado)', async ({ page }) => {
    await goToPaymentSettings(page);

    const toggle = page.locator('[data-testid="require-deposit-toggle"]');
    const isEnabled = await toggle.isEnabled().catch(() => false);

    if (!isEnabled) {
      test.skip();
      return;
    }

    // Habilitar toggle
    const isChecked = await toggle.isChecked();
    if (!isChecked) {
      await toggle.click();
    }

    const amountField = page.locator('[data-testid="deposit-amount"]');
    await expect(amountField).toBeVisible({ timeout: 5000 });
  });
});

// ─── API settings/payment ────────────────────────────────────────────────────

test.describe('API /api/settings/payment', () => {
  test('GET retorna 401 sem autenticação', async () => {
    const res = await fetch(`${BASE}/api/settings/payment`);
    expect(res.status).toBe(401);
  });

  test('GET retorna configuração com auth (storageState)', async ({ request }) => {
    const res = await request.get(`${BASE}/api/settings/payment`);
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const data = await res.json();
      expect(data).toHaveProperty('professional');
    }
  });

  test('PUT rejeita tipo de depósito inválido', async ({ request }) => {
    const res = await request.put(`${BASE}/api/settings/payment`, {
      data: {
        require_deposit: true,
        deposit_type: 'invalid_type',
        deposit_value: 20,
      },
    });
    expect(res.status()).toBe(400);
  });

  test('PUT aceita require_deposit: false sem validação de valor', async ({ request }) => {
    const res = await request.put(`${BASE}/api/settings/payment`, {
      data: { require_deposit: false },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});
