/**
 * CRM de Clientes
 */
import { test, expect } from '@playwright/test';
import { TEST } from '../helpers/config';

const BASE = TEST.BASE_URL;

test.describe('Dashboard — Clientes', () => {
  test('carrega heading e abas CRM / Gerenciar', async ({ page }) => {
    await page.goto(`${BASE}/clients`);
    await expect(page.getByText(/clientes/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /crm/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /gerenciar/i })).toBeVisible();
  });

  test('aba CRM mostra filtros de segmentação', async ({ page }) => {
    await page.goto(`${BASE}/clients`);
    // Filtros de segmentação
    await expect(page.getByRole('button', { name: /todos/i }).first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/aniversariantes/i)).toBeVisible();
  });

  test('aba Gerenciar mostra botão Adicionar Contato', async ({ page }) => {
    await page.goto(`${BASE}/clients`);
    await page.getByRole('button', { name: /gerenciar/i }).click();
    await expect(page.getByRole('button', { name: /adicionar contato/i })).toBeVisible({ timeout: 10_000 });
  });

  test('aba Gerenciar mostra botão Importar CSV', async ({ page }) => {
    await page.goto(`${BASE}/clients`);
    await page.getByRole('button', { name: /gerenciar/i }).click();
    await expect(page.getByRole('button', { name: /importar csv/i })).toBeVisible({ timeout: 10_000 });
  });
});
