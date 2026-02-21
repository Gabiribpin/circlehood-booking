/**
 * Telas principais: Dashboard Home, Agendamentos, Analytics
 */
import { test, expect } from '@playwright/test';
import { TEST } from '../helpers/config';

const BASE = TEST.BASE_URL;

test.describe('Dashboard — Home', () => {
  test('carrega com saudação e seções de métricas', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await expect(page.locator('h1, h2').first()).toContainText(/olá|ola|salão|salao|rita/i, { timeout: 15_000 });
    await expect(page.getByText(/agendamentos/i).first()).toBeVisible();
    await expect(page.getByText(/receita/i).first()).toBeVisible();
  });

  test('link "Ver minha página" visível', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await expect(
      page.getByRole('link', { name: /ver minha página|minha página/i }).first()
    ).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Dashboard — Agendamentos', () => {
  test('carrega com heading e abas de filtro', async ({ page }) => {
    await page.goto(`${BASE}/bookings`);
    // heading específico (evita strict mode com o link na nav)
    await expect(page.getByRole('heading', { name: 'Agendamentos' })).toBeVisible({ timeout: 15_000 });
    // filtros são role="tab" no Radix UI
    await expect(page.getByRole('tab', { name: /todos/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /confirmados/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /cancelados/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /concluídos/i })).toBeVisible();
  });

  test('aba Cancelados filtra a lista', async ({ page }) => {
    await page.goto(`${BASE}/bookings`);
    await page.getByRole('tab', { name: /cancelados/i }).click();
    await expect(page.locator('body')).not.toContainText(/erro interno|500/i);
  });
});

test.describe('Dashboard — Analytics', () => {
  test('carrega heading e painel de insights', async ({ page }) => {
    await page.goto(`${BASE}/analytics`);
    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('body')).not.toContainText(/erro interno|500/i);
  });
});
