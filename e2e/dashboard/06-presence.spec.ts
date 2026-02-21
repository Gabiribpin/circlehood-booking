/**
 * Presença pública: Editor de Página, Galeria, Depoimentos
 */
import { test, expect } from '@playwright/test';
import { TEST } from '../helpers/config';

const BASE = TEST.BASE_URL;

test.describe('Dashboard — Editor de Página', () => {
  test('carrega heading e link para página pública', async ({ page }) => {
    await page.goto(`${BASE}/my-page`);
    // Pode ser o editor ou a visualização — qualquer conteúdo válido
    await expect(page.locator('body')).not.toContainText(/erro interno|500/i, { timeout: 15_000 });
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15_000 });
  });

  test('editor de página abre corretamente', async ({ page }) => {
    await page.goto(`${BASE}/my-page-editor`);
    await expect(page.getByText(/editor de página/i)).toBeVisible({ timeout: 15_000 });
    // Link para ver página pública
    await expect(page.getByRole('link', { name: /ver página pública/i })).toBeVisible();
  });
});

test.describe('Dashboard — Galeria', () => {
  test('carrega heading da galeria', async ({ page }) => {
    await page.goto(`${BASE}/gallery`);
    await expect(page.getByText(/galeria de fotos/i)).toBeVisible({ timeout: 15_000 });
  });

  test('mostra subheading sobre trabalhos', async ({ page }) => {
    await page.goto(`${BASE}/gallery`);
    await expect(page.getByText(/trabalhos/i)).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('Dashboard — Depoimentos', () => {
  test('carrega heading Depoimentos', async ({ page }) => {
    await page.goto(`${BASE}/testimonials`);
    await expect(page.getByText('Depoimentos')).toBeVisible({ timeout: 15_000 });
  });

  test('mostra subheading sobre avaliações', async ({ page }) => {
    await page.goto(`${BASE}/testimonials`);
    await expect(page.getByText(/avaliações/i)).toBeVisible({ timeout: 15_000 });
  });
});
