/**
 * Testes E2E — Regressão da rota /callback
 *
 * A rota de callback foi modificada para:
 *  - User COM professional → redirect /dashboard (comportamento existente)
 *  - User SEM professional → redirect /complete-profile (novo)
 *
 * Também valida que o fluxo email existente não foi quebrado.
 */
import { test, expect } from '@playwright/test';
import { TEST } from '../helpers/config';

const BASE = TEST.BASE_URL;

test.describe('Callback Route — Regressão', () => {
  // ── 1. Callback sem code → redirect para login com erro ───────────────
  test('GET /callback sem code → redirect para /login?error=auth', async ({ request }) => {
    const res = await request.get(`${BASE}/callback`, {
      maxRedirects: 0,
    });
    // Deve retornar 307 (redirect) para /login?error=auth
    expect([301, 302, 307, 308]).toContain(res.status());
    const location = res.headers()['location'] || '';
    expect(location).toMatch(/\/login.*error=auth/);
  });

  // ── 2. Callback com code inválido → redirect para login com erro ──────
  test('GET /callback?code=invalid → redirect para /login?error=auth', async ({ request }) => {
    const res = await request.get(`${BASE}/callback?code=invalid-code-12345`, {
      maxRedirects: 0,
    });
    expect([301, 302, 307, 308]).toContain(res.status());
    const location = res.headers()['location'] || '';
    expect(location).toMatch(/\/login.*error=auth/);
  });

  // ── 3. Login email/senha → dashboard funciona (regressão) ─────────────
  test('login normal por email/senha → dashboard carrega sem redirect', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.locator('#email')).toBeVisible({ timeout: 15_000 });

    await page.fill('#email', TEST.USER_EMAIL);
    await page.fill('#password', TEST.USER_PASSWORD);
    await page.click('button[type="submit"]');

    // Deve ir para dashboard normalmente (não para /complete-profile)
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    // Dashboard deve mostrar conteúdo (não redirecionou para complete-profile)
    await expect(page.getByText(/complete.*(seu perfil|your profile)/i)).not.toBeVisible({ timeout: 5_000 });
  });

  // ── 4. i18n: botões sociais em inglês ─────────────────────────────────
  test('login em en-US exibe "or continue with"', async ({ page }) => {
    await page.goto(`${BASE}/en-US/login`);
    await expect(page.locator('#email')).toBeVisible({ timeout: 15_000 });

    await expect(page.getByText(/or continue with/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible();
  });
});
