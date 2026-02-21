/**
 * Conta: Configurações, Integrações
 */
import { test, expect } from '@playwright/test';
import { TEST } from '../helpers/config';

const BASE = TEST.BASE_URL;

test.describe('Dashboard — Configurações', () => {
  test('carrega heading Configurações', async ({ page }) => {
    await page.goto(`${BASE}/settings`);
    await expect(
      page.getByRole('heading', { name: 'Configurações' })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('mostra cards de Plano e Conta', async ({ page }) => {
    await page.goto(`${BASE}/settings`);
    await expect(
      page.getByText(/plano.*assinatura|assinatura.*plano/i).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Conta').first()).toBeVisible();
  });

  test('campos de nome e slug visíveis', async ({ page }) => {
    await page.goto(`${BASE}/settings`);
    await expect(page.locator('#businessName')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#slug')).toBeVisible();
  });

  test('botão Salvar Alterações visível', async ({ page }) => {
    await page.goto(`${BASE}/settings`);
    await expect(
      page.getByRole('button', { name: /salvar alterações/i })
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Dashboard — Integrações', () => {
  test('carrega sem erro', async ({ page }) => {
    await page.goto(`${BASE}/integrations`);
    await expect(page.locator('body')).not.toContainText(/erro interno|500/i, { timeout: 15_000 });
    await expect(page.locator('h1, h2, .container').first()).toBeVisible({ timeout: 15_000 });
  });
});
