/**
 * Performance Básica — Tempo de carregamento e console errors
 *
 * Cenários cobertos:
 *  1. Página pública do profissional carrega em < 5s (cold start Vercel)
 *  2. Dashboard home carrega em < 5s
 *  3. Página de agendamentos carrega em < 5s
 *  4. Página de analytics carrega em < 5s
 *  5. Zero erros JavaScript críticos no console em cada página
 *
 * Projeto: performance (Chromium, storageState para dashboard)
 *
 * Execução local:
 *   npx playwright test --project=auth-setup --project=performance
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { TEST } from '../helpers/config';

const BASE = TEST.BASE_URL;
const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);

// Limiar de tempo de carregamento (ms)
// 5s: adequado para cold start Vercel (~3-5s) + margin
const LOAD_THRESHOLD_MS = 5_000;

// Erros de console que são falsos positivos (providers externos, extensões)
const IGNORED_ERROR_PATTERNS = [
  /favicon/i,
  /chrome-extension/i,
  /moz-extension/i,
  /ResizeObserver loop/i,
  // Erros de providers externos esperados em dev/staging
  /Failed to load resource.*resend/i,
  /Failed to load resource.*evolution/i,
];

function isIgnoredError(msg: string): boolean {
  return IGNORED_ERROR_PATTERNS.some((pattern) => pattern.test(msg));
}

async function getProfessionalSlug(): Promise<string | null> {
  const { data } = await supabase
    .from('professionals')
    .select('slug')
    .eq('id', TEST.PROFESSIONAL_ID)
    .single();
  return data?.slug ?? null;
}

test.describe('Performance — Tempo de Carregamento', () => {
  test('página pública carrega em < 5s e sem erros críticos', async ({ page }) => {
    const slug = await getProfessionalSlug();
    if (!slug) test.skip();

    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnoredError(msg.text())) {
        errors.push(msg.text());
      }
    });

    // Ignorar erros de rede de providers externos
    page.on('pageerror', (err) => {
      if (!isIgnoredError(err.message)) {
        errors.push(`PageError: ${err.message}`);
      }
    });

    const start = Date.now();
    await page.goto(`${BASE}/${slug}`, { waitUntil: 'load' });
    const elapsed = Date.now() - start;

    // Página deve exibir o nome do negócio (conteúdo carregou)
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 5_000 });

    // Tempo de carregamento
    expect(elapsed, `Página pública demorou ${elapsed}ms (limite: ${LOAD_THRESHOLD_MS}ms)`).toBeLessThan(
      LOAD_THRESHOLD_MS
    );

    // Zero erros críticos no console
    expect(errors, `Erros de console: ${errors.join(', ')}`).toHaveLength(0);
  });

  test('dashboard home carrega em < 5s e sem erros críticos', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnoredError(msg.text())) {
        errors.push(msg.text());
      }
    });

    const start = Date.now();
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'load' });
    const elapsed = Date.now() - start;

    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8_000 });

    expect(elapsed, `Dashboard demorou ${elapsed}ms`).toBeLessThan(LOAD_THRESHOLD_MS);
    expect(errors, `Erros: ${errors.join(', ')}`).toHaveLength(0);
  });

  test('página de agendamentos carrega em < 5s e sem erros críticos', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnoredError(msg.text())) {
        errors.push(msg.text());
      }
    });

    const start = Date.now();
    await page.goto(`${BASE}/bookings`, { waitUntil: 'load' });
    const elapsed = Date.now() - start;

    await expect(page.getByRole('heading', { name: 'Agendamentos' })).toBeVisible({ timeout: 8_000 });

    expect(elapsed, `Agendamentos demorou ${elapsed}ms`).toBeLessThan(LOAD_THRESHOLD_MS);
    expect(errors, `Erros: ${errors.join(', ')}`).toHaveLength(0);
  });

  test('página de analytics carrega em < 5s e sem erros críticos', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isIgnoredError(msg.text())) {
        errors.push(msg.text());
      }
    });

    const start = Date.now();
    await page.goto(`${BASE}/analytics`, { waitUntil: 'load' });
    const elapsed = Date.now() - start;

    // KPI "Análises" deve ser visível após load
    await expect(page.getByRole('heading', { name: 'Análises' })).toBeVisible({ timeout: 8_000 });

    expect(elapsed, `Analytics demorou ${elapsed}ms`).toBeLessThan(LOAD_THRESHOLD_MS);
    expect(errors, `Erros: ${errors.join(', ')}`).toHaveLength(0);
  });
});

test.describe('Performance — Console Errors Detalhado', () => {
  test('nenhuma página do dashboard tem erros JavaScript críticos', async ({ page }) => {
    const allErrors: { page: string; error: string }[] = [];

    const pages = [
      { name: 'dashboard', url: `${BASE}/dashboard` },
      { name: 'bookings', url: `${BASE}/bookings` },
      { name: 'analytics', url: `${BASE}/analytics` },
      { name: 'services', url: `${BASE}/services` },
    ];

    for (const p of pages) {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error' && !isIgnoredError(msg.text())) {
          errors.push(msg.text());
        }
      });

      await page.goto(p.url, { waitUntil: 'load' });
      // Aguardar conteúdo principal
      await page.waitForTimeout(2_000);

      for (const e of errors) {
        allErrors.push({ page: p.name, error: e });
      }

      // Remover listener para a próxima iteração
      page.removeAllListeners('console');
    }

    if (allErrors.length > 0) {
      const summary = allErrors.map((e) => `[${e.page}] ${e.error}`).join('\n');
      expect.soft(allErrors, `Erros de console encontrados:\n${summary}`).toHaveLength(0);
    }
  });
});
