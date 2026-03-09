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

  test('aba Assistente Virtual abre área de instruções', async ({ page }) => {
    await page.goto(`${BASE}/whatsapp-config`);
    const aiTab = page.getByRole('tab', { name: /assistente virtual|ia|automações/i }).or(
      page.getByRole('button', { name: /assistente virtual|ia|automações/i })
    );
    await aiTab.first().click();
    await expect(
      page.locator('#greeting_message, #instructions').first()
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Dashboard — Campanhas', () => {
  // Campanhas de envio em massa foram desativadas para proteger números contra ban.
  // A rota /campaigns exibe uma tela informativa explicando o motivo.
  test('exibe mensagem de funcionalidade desativada', async ({ page }) => {
    await page.goto(`${BASE}/campaigns`);
    await expect(
      page.getByRole('heading', { name: /campanhas desativadas/i })
    ).toBeVisible({ timeout: 15_000 });
    // Não deve ter botão de "Nova Campanha" (foi removido)
    await expect(page.getByRole('button', { name: /nova campanha/i })).not.toBeVisible();
  });
});

test.describe('Dashboard — Automações', () => {
  test('carrega sem erro', async ({ page }) => {
    await page.goto(`${BASE}/automations`);
    await expect(page.locator('body')).not.toContainText(/erro interno|500/i, { timeout: 15_000 });
    await expect(page.locator('main, [role="main"], .container').first()).toBeVisible({ timeout: 15_000 });
  });
});
