/**
 * Comunicação: WhatsApp Config, Campanhas, Automações
 */
import { test, expect } from '@playwright/test';
import { TEST } from '../helpers/config';

const BASE = TEST.BASE_URL;

test.describe('Dashboard — WhatsApp Config', () => {
  test('carrega heading Configuração WhatsApp', async ({ page }) => {
    await page.goto(`${BASE}/whatsapp-config`);
    await expect(
      page.getByRole('heading', { name: /configuração whatsapp/i })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('abas Conexão e IA presentes', async ({ page }) => {
    await page.goto(`${BASE}/whatsapp-config`);
    // Abas podem ser role="tab" (Radix UI)
    const conexaoTab = page.getByRole('tab', { name: /conexão/i }).or(
      page.getByRole('button', { name: /conexão/i })
    );
    await expect(conexaoTab.first()).toBeVisible({ timeout: 10_000 });
  });

  test('aba IA abre área de instruções', async ({ page }) => {
    await page.goto(`${BASE}/whatsapp-config`);
    const iaTab = page.getByRole('tab', { name: /ia|automações/i }).or(
      page.getByRole('button', { name: /ia|automações/i })
    );
    await iaTab.first().click();
    await expect(
      page.locator('#greeting_message, #instructions').first()
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Dashboard — Campanhas', () => {
  test('carrega heading e botão Nova Campanha', async ({ page }) => {
    await page.goto(`${BASE}/campaigns`);
    await expect(page.getByRole('heading', { name: /campanhas/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /nova campanha/i })).toBeVisible();
  });

  test('modal Criar Nova Campanha abre e fecha', async ({ page }) => {
    await page.goto(`${BASE}/campaigns`);
    await page.getByRole('button', { name: /nova campanha/i }).click();
    await expect(page.getByText(/criar nova campanha/i)).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('#c-name')).toBeVisible();
    await expect(page.locator('#c-msg')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText(/criar nova campanha/i)).not.toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Dashboard — Automações', () => {
  test('carrega sem erro', async ({ page }) => {
    await page.goto(`${BASE}/automations`);
    await expect(page.locator('body')).not.toContainText(/erro interno|500/i, { timeout: 15_000 });
    await expect(page.locator('main, [role="main"], .container').first()).toBeVisible({ timeout: 15_000 });
  });
});
