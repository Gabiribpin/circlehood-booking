/**
 * Catálogo: Serviços (com modal) + Horários
 */
import { test, expect } from '@playwright/test';
import { TEST } from '../helpers/config';

const BASE = TEST.BASE_URL;

test.describe('Dashboard — Serviços', () => {
  test('carrega heading e botão Adicionar', async ({ page }) => {
    await page.goto(`${BASE}/services`);
    await expect(page.getByText('Serviços')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /adicionar servi/i })).toBeVisible();
  });

  test('modal "Novo serviço" abre e fecha', async ({ page }) => {
    await page.goto(`${BASE}/services`);
    await page.getByRole('button', { name: /adicionar servi/i }).click();

    // Modal deve abrir
    await expect(page.getByText(/novo servi/i)).toBeVisible({ timeout: 8_000 });

    // Campos obrigatórios presentes
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#duration')).toBeVisible();
    await expect(page.locator('#price')).toBeVisible();

    // Fechar com ESC
    await page.keyboard.press('Escape');
    await expect(page.getByText(/novo servi/i)).not.toBeVisible({ timeout: 5_000 });
  });

  test('modal preenchido mostra botão Sugerir com IA', async ({ page }) => {
    await page.goto(`${BASE}/services`);
    await page.getByRole('button', { name: /adicionar servi/i }).click();
    await expect(page.getByRole('button', { name: /sugerir com ia/i })).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('Dashboard — Horários', () => {
  test('carrega heading e abas', async ({ page }) => {
    await page.goto(`${BASE}/schedule`);
    await expect(page.getByText('Horários')).toBeVisible({ timeout: 15_000 });
    // Aba de dias bloqueados
    await expect(page.getByRole('button', { name: /dias bloqueados/i })).toBeVisible();
  });

  test('botão Salvar horários visível', async ({ page }) => {
    await page.goto(`${BASE}/schedule`);
    await expect(page.getByRole('button', { name: /salvar horários/i })).toBeVisible({ timeout: 15_000 });
  });

  test('aba Dias bloqueados mostra calendário', async ({ page }) => {
    await page.goto(`${BASE}/schedule`);
    await page.getByRole('button', { name: /dias bloqueados/i }).click();
    // Botão de bloquear data deve aparecer
    await expect(page.getByRole('button', { name: /bloquear data/i })).toBeVisible({ timeout: 8_000 });
  });
});
