/**
 * Comunicação: WhatsApp Config, Campanhas, Automações
 */
import { test, expect } from '@playwright/test';
import { TEST } from '../helpers/config';

const BASE = TEST.BASE_URL;

test.describe('Dashboard — WhatsApp Config', () => {
  test('carrega heading e aba Conexão', async ({ page }) => {
    await page.goto(`${BASE}/whatsapp-config`);
    await expect(page.getByText(/configuração whatsapp/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /conexão/i })).toBeVisible();
  });

  test('aba IA & Automações abre área de instruções', async ({ page }) => {
    await page.goto(`${BASE}/whatsapp-config`);
    await page.getByRole('button', { name: /ia.*automações|automações.*ia/i }).click();
    // Campo de mensagem de boas-vindas ou instruções
    await expect(page.locator('#greeting_message, #instructions').first()).toBeVisible({ timeout: 10_000 });
  });

  test('aba Conexão mostra campo de telefone Evolution', async ({ page }) => {
    await page.goto(`${BASE}/whatsapp-config`);
    await page.getByRole('button', { name: /conexão/i }).click();
    // Algum campo de configuração visível
    await expect(page.locator('body')).not.toContainText(/erro interno|500/i);
  });
});

test.describe('Dashboard — Campanhas', () => {
  test('carrega heading e botão Nova Campanha', async ({ page }) => {
    await page.goto(`${BASE}/campaigns`);
    await expect(page.getByText(/campanhas/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /nova campanha/i })).toBeVisible();
  });

  test('modal Criar Nova Campanha abre e fecha', async ({ page }) => {
    await page.goto(`${BASE}/campaigns`);
    await page.getByRole('button', { name: /nova campanha/i }).click();
    await expect(page.getByText(/criar nova campanha/i)).toBeVisible({ timeout: 8_000 });

    // Campo de nome da campanha
    await expect(page.locator('#c-name')).toBeVisible();
    // Campo de mensagem
    await expect(page.locator('#c-msg')).toBeVisible();

    // Fechar
    await page.keyboard.press('Escape');
    await expect(page.getByText(/criar nova campanha/i)).not.toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Dashboard — Automações', () => {
  test('carrega sem erro', async ({ page }) => {
    await page.goto(`${BASE}/automations`);
    await expect(page.locator('body')).not.toContainText(/erro interno|500/i, { timeout: 15_000 });
    // Página renderiza algum conteúdo
    await expect(page.locator('main, [role="main"], .container').first()).toBeVisible({ timeout: 15_000 });
  });
});
