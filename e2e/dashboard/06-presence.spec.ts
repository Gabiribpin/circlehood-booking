/**
 * Presença pública: Editor de Página, Galeria, Depoimentos
 */
import { test, expect } from '@playwright/test';
import { TEST } from '../helpers/config';

const BASE = TEST.BASE_URL;

test.describe('Dashboard — Editor de Página', () => {
  test('my-page carrega sem erro', async ({ page }) => {
    await page.goto(`${BASE}/my-page`);
    await expect(page.locator('body')).not.toContainText(/erro interno|500/i, { timeout: 15_000 });
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15_000 });
  });

  test('my-page-editor carrega heading correto', async ({ page }) => {
    await page.goto(`${BASE}/my-page-editor`);
    await expect(
      page.getByRole('heading', { name: /editor de página/i })
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('link', { name: /ver página pública/i })
    ).toBeVisible();
  });
});

test.describe('Dashboard — Galeria', () => {
  test('carrega heading Galeria de Fotos', async ({ page }) => {
    await page.goto(`${BASE}/gallery`);
    await expect(
      page.getByRole('heading', { name: /galeria de fotos/i })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('mostra subheading descritivo', async ({ page }) => {
    await page.goto(`${BASE}/gallery`);
    // Qualquer texto descritivo sobre a galeria
    await expect(
      page.locator('p, span').filter({ hasText: /página pública|trabalhos|fotos/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Dashboard — Depoimentos', () => {
  test('carrega heading Depoimentos', async ({ page }) => {
    await page.goto(`${BASE}/testimonials`);
    await expect(
      page.getByRole('heading', { name: 'Depoimentos' })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('mostra subheading sobre avaliações', async ({ page }) => {
    await page.goto(`${BASE}/testimonials`);
    await expect(
      page.locator('p, span').filter({ hasText: /avaliações|clientes|página/i }).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
