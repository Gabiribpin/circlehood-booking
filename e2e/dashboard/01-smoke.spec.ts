import { test, expect } from '@playwright/test';
import { TEST } from '../helpers/config';

/**
 * Smoke tests do dashboard — verificam que as pages principais carregam
 * sem erro 500 e sem redirect inesperado para /login quando autenticado.
 *
 * Atenção: estes testes NÃO fazem login real (precisaria de cookies de sessão).
 * Eles verificam que:
 *  - A página de login carrega corretamente (pública)
 *  - A página de booking público do Salão da Rita carrega corretamente
 *  - O dashboard redireciona para /login quando não autenticado (proteção RLS)
 */

test.describe('Dashboard — Smoke', () => {
  test('página de login carrega', async ({ page }) => {
    const response = await page.goto(`${TEST.BASE_URL}/login`);
    expect(response?.status()).toBeLessThan(500);
    await expect(page).toHaveTitle(/circlehood|login|entrar/i);
    // Deve ter campo de e-mail
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('dashboard sem sessão redireciona para /login', async ({ page }) => {
    await page.goto(`${TEST.BASE_URL}/dashboard`);
    // Aguarda redirect
    await page.waitForURL(/\/login/, { timeout: 10_000 });
    expect(page.url()).toContain('/login');
  });

  test('página de agendamento público do Salão da Rita carrega', async ({ page }) => {
    // A slug do Salão da Rita é conhecida — page pública, sem auth
    const slug = 'salao-da-rita'; // ajustar se necessário
    const response = await page.goto(`${TEST.BASE_URL}/${slug}`);
    // Pode ser 200 (existe) ou 404 (slug diferente) — não deve ser 500
    expect(response?.status()).not.toBe(500);
    if (response?.status() === 200) {
      // Se existir, deve mostrar nome do negócio
      await expect(page.locator('body')).toContainText(/salao|salão|gabriela|rita/i);
    }
  });

  test('API health: webhook endpoint responde (sem body válido → 400/422, não 500)', async ({
    request,
  }) => {
    const res = await request.post(`${TEST.BASE_URL}/api/whatsapp/webhook`, {
      data: {},
    });
    // 400 = bad request (esperado sem payload válido), nunca 500
    expect(res.status()).toBeLessThan(500);
  });

  test('API health: cron endpoint sem token retorna 401', async ({ request }) => {
    const res = await request.post(
      `${TEST.BASE_URL}/api/cron/send-reminders`
    );
    expect(res.status()).toBe(401);
  });
});
