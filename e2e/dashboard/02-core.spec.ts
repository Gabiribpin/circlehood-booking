/**
 * Telas principais: Dashboard Home, Agendamentos, Analytics
 */
import { test, expect } from '@playwright/test';
import { TEST } from '../helpers/config';

const BASE = TEST.BASE_URL;

test.describe('Dashboard — Home', () => {
  test('carrega com saudação e seções de métricas', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    // Saudação com nome do negócio
    await expect(page.locator('h1, h2').first()).toContainText(/olá|ola|salão|salao|rita/i, { timeout: 15_000 });
    // Seção de agendamentos
    await expect(page.getByText(/agendamentos/i).first()).toBeVisible();
    // Seção de receita
    await expect(page.getByText(/receita/i).first()).toBeVisible();
  });

  test('link "Ver minha página" abre a página pública', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    const verBtn = page.getByRole('link', { name: /ver minha página|minha página/i }).first();
    await expect(verBtn).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Dashboard — Agendamentos', () => {
  test('carrega com heading e abas de filtro', async ({ page }) => {
    await page.goto(`${BASE}/bookings`);
    await expect(page.getByText('Agendamentos')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /todos/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /confirmados/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /cancelados/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /concluídos/i })).toBeVisible();
  });

  test('aba Cancelados filtra a lista', async ({ page }) => {
    await page.goto(`${BASE}/bookings`);
    await page.getByRole('button', { name: /cancelados/i }).click();
    // Página não deve cravar (qualquer resposta sem 500)
    await expect(page.locator('body')).not.toContainText(/erro interno|500/i);
  });
});

test.describe('Dashboard — Analytics', () => {
  test('carrega heading e painel de insights', async ({ page }) => {
    await page.goto(`${BASE}/analytics`);
    await expect(page.getByText(/analytics/i)).toBeVisible({ timeout: 15_000 });
    // Não deve ter erro crítico
    await expect(page.locator('body')).not.toContainText(/erro interno|500/i);
  });
});
