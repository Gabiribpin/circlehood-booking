/**
 * Catálogo: Serviços (com modal) + Horários
 */
import { test, expect } from '@playwright/test';
import { TEST } from '../helpers/config';

const BASE = TEST.BASE_URL;

test.describe('Dashboard — Serviços', () => {
  test('carrega heading e botão Adicionar', async ({ page }) => {
    await page.goto(`${BASE}/services`);
    await expect(page.getByRole('heading', { name: 'Serviços' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /adicionar servi/i })).toBeVisible();
  });

  test('modal "Novo serviço" abre e fecha', async ({ page }) => {
    await page.goto(`${BASE}/services`);
    await page.getByRole('button', { name: /adicionar servi/i }).click();
    await expect(page.getByRole('heading', { name: /novo servi/i })).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#duration')).toBeVisible();
    await expect(page.locator('#price')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: /novo servi/i })).not.toBeVisible({ timeout: 5_000 });
  });

  test('modal mostra botão Sugerir com IA', async ({ page }) => {
    await page.goto(`${BASE}/services`);
    await page.getByRole('button', { name: /adicionar servi/i }).click();
    await expect(page.getByRole('button', { name: /sugerir com ia/i })).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('Dashboard — Horários', () => {
  test('carrega heading e abas', async ({ page }) => {
    await page.goto(`${BASE}/schedule`);
    await expect(page.getByRole('heading', { name: 'Horários' })).toBeVisible({ timeout: 15_000 });
    // Aba "Horários" e "Dias bloqueados" são role="tab" (Radix UI)
    await expect(page.getByRole('tab', { name: /^horários$/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /dias bloqueados/i })).toBeVisible();
  });

  test('botão Salvar horários visível', async ({ page }) => {
    await page.goto(`${BASE}/schedule`);
    await expect(page.getByRole('button', { name: /salvar horários/i })).toBeVisible({ timeout: 15_000 });
  });

  test('aba Dias bloqueados mostra botão Bloquear data', async ({ page }) => {
    await page.goto(`${BASE}/schedule`);
    await page.getByRole('tab', { name: /dias bloqueados/i }).click();
    await expect(page.getByRole('button', { name: /bloquear data/i })).toBeVisible({ timeout: 8_000 });
  });
});
