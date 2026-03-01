/**
 * E2E: Configurações de Pagamento (sinal/depósito) — UI tests
 *
 * Testa a tela /settings/payment:
 *  1. Ativar toggle "Exigir sinal" → salvar → recarregar → confirmar ativo
 *  2. Desativar toggle → salvar → recarregar → confirmar desativado
 *  3. Tipo percentagem → valor 25% → salvar → recarregar → confirmar persistência
 *  4. Tipo valor fixo → valor 10 → salvar → recarregar → confirmar persistência
 *
 * Cleanup: afterAll desativa sinal via Supabase service role.
 *
 * Usa storageState do auth-setup. Requer auth.
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

/** Navega para a página, aguarda o h1 e retorna o Switch do sinal. */
async function gotoPayment(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/settings/payment`, { waitUntil: 'domcontentloaded' });
  // Dashboard layout may redirect to /subscribe if subscription inactive
  if (page.url().includes('/subscribe')) {
    throw new Error('Redirect to /subscribe — subscription inactive. Auth setup should set subscription_status=active.');
  }
  await expect(page.locator('h1').first()).toContainText('Pagamentos', { timeout: 20_000 });
  const sw = page.getByRole('switch').first();
  await sw.waitFor({ state: 'visible', timeout: 15_000 });
  return sw;
}

async function saveAndWait(page: import('@playwright/test').Page) {
  // O botão de guardar pode dizer "Guardar configurações" ou "Guardado!"
  await page.getByRole('button', { name: /Guardar|Save|Guardar cambios/i }).last().click();
  await expect(page.getByRole('button', { name: /Guardado|Saved|Guardado/i })).toBeVisible({
    timeout: 30_000,
  });
}

test.describe('Payments — Configurações de Sinal', () => {
  test.beforeAll(async () => {
    await resetPaymentSettings();
  });

  test.afterAll(async () => {
    await resetPaymentSettings();
  });

  // ── 1. Ativar sinal ────────────────────────────────────────────────────────

  test('1. Ativar sinal: salva e persiste ao recarregar', async ({ page }) => {
    test.setTimeout(90_000);
    const sw = await gotoPayment(page);

    // Garantir que está OFF
    const isOn = (await sw.getAttribute('aria-checked')) === 'true';
    if (isOn) {
      await sw.click();
      await saveAndWait(page);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await sw.waitFor({ state: 'visible', timeout: 15_000 });
    }

    // Ligar
    await sw.click();
    // Aguardar campo de valor aparecer (renderização condicional)
    await page.locator('#depositValue').waitFor({ state: 'visible', timeout: 5_000 });
    // Preencher valor obrigatório
    await page.locator('#depositValue').fill('30');

    await saveAndWait(page);

    // Recarregar e confirmar
    await page.reload({ waitUntil: 'domcontentloaded' });
    const swAfter = page.getByRole('switch').first();
    await swAfter.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(swAfter).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#depositValue')).toHaveValue('30');
  });

  // ── 2. Desativar sinal ─────────────────────────────────────────────────────

  test('2. Desativar sinal: salva e persiste ao recarregar', async ({ page }) => {
    test.setTimeout(90_000);
    const sw = await gotoPayment(page);

    // Garantir que está ON (state left by test 1)
    const isOn = (await sw.getAttribute('aria-checked')) === 'true';
    if (!isOn) {
      await sw.click();
      await page.locator('#depositValue').waitFor({ state: 'visible', timeout: 5_000 });
      await page.locator('#depositValue').fill('30');
      await saveAndWait(page);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await sw.waitFor({ state: 'visible', timeout: 15_000 });
    }

    // Desligar
    await sw.click();
    await saveAndWait(page);

    // Recarregar e confirmar
    await page.reload({ waitUntil: 'domcontentloaded' });
    const swAfter = page.getByRole('switch').first();
    await swAfter.waitFor({ state: 'visible', timeout: 15_000 });
    await expect(swAfter).toHaveAttribute('aria-checked', 'false');
    // Input de valor não deve estar visível quando desativado
    await expect(page.locator('#depositValue')).not.toBeVisible();
  });

  // ── 3. Tipo percentagem ────────────────────────────────────────────────────

  test('3. Tipo percentagem (25%): salva e persiste ao recarregar', async ({ page }) => {
    const sw = await gotoPayment(page);

    // Ligar se necessário
    if ((await sw.getAttribute('aria-checked')) !== 'true') {
      await sw.click();
    }

    // Selecionar tipo percentagem
    await page.getByRole('button', { name: /Percentagem|Percentage/i }).click();
    await page.locator('#depositValue').fill('25');
    await saveAndWait(page);

    // Recarregar e confirmar
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('switch').first().waitFor({ state: 'visible', timeout: 15_000 });
    await expect(page.locator('#depositValue')).toHaveValue('25');
    // Botão percentagem deve estar activo (tem classe border-primary)
    await expect(page.getByRole('button', { name: /Percentagem|Percentage/i })).toBeVisible();
  });

  // ── 4. Tipo valor fixo ─────────────────────────────────────────────────────

  test('4. Tipo valor fixo (10): salva e persiste ao recarregar', async ({ page }) => {
    const sw = await gotoPayment(page);

    // Ligar se necessário
    if ((await sw.getAttribute('aria-checked')) !== 'true') {
      await sw.click();
    }

    // Selecionar tipo fixo — o botão contém "Valor fixo" + símbolo da moeda
    await page.getByRole('button', { name: /Valor fixo|Fixed/i }).click();
    await page.locator('#depositValue').fill('10');
    await saveAndWait(page);

    // Recarregar e confirmar
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('switch').first().waitFor({ state: 'visible', timeout: 15_000 });
    await expect(page.locator('#depositValue')).toHaveValue('10');
    await expect(page.getByRole('button', { name: /Valor fixo|Fixed/i })).toBeVisible();
  });
});
