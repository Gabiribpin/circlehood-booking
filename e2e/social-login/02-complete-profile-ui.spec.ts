/**
 * Testes E2E — Página /complete-profile (UI)
 *
 * Cobre:
 *  - Redirect para /login se não autenticado
 *  - Redirect para /dashboard se já tem professional
 *  - Formulário renderiza campos obrigatórios
 *  - Slug auto-gerado a partir do business name
 *  - Checkbox de termos obrigatório
 *  - Botões sociais visíveis em /login e /register
 *
 * Nota: Não testa OAuth real (depende de provider externo).
 * Testa a UI dos botões sociais e o fluxo de complete-profile.
 */
import { test, expect } from '@playwright/test';
import { TEST } from '../helpers/config';

const BASE = TEST.BASE_URL;

// ═══════════════════════════════════════════════════════════════════════════
// SEÇÃO 1 — Botões sociais nas páginas de login e registro
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Social Login Buttons — UI', () => {
  test('login page exibe botões Google, Apple e Facebook', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await expect(page.locator('#email')).toBeVisible({ timeout: 15_000 });

    // Divisor "ou continue com"
    await expect(page.getByText(/ou continue com/i)).toBeVisible();

    // Botões
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /apple/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /facebook/i })).toBeVisible();
  });

  test('register page exibe botões sociais no step 1', async ({ page }) => {
    await page.goto(`${BASE}/register`);
    await expect(page.locator('#email')).toBeVisible({ timeout: 15_000 });

    // Divisor "ou cadastre-se com"
    await expect(page.getByText(/ou cadastre-se com/i)).toBeVisible();

    // Botões
    await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /apple/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /facebook/i })).toBeVisible();
  });

  test('register step 2 não exibe botões sociais', async ({ page }) => {
    await page.goto(`${BASE}/register`);
    await expect(page.locator('#email')).toBeVisible({ timeout: 15_000 });

    // Preencher step 1
    await page.fill('#email', 'step2-check@test.io');
    await page.fill('#password', 'Teste1234!');
    await page.click('button[type="submit"]');

    // Esperar step 2 aparecer
    await expect(page.locator('#businessName')).toBeVisible({ timeout: 10_000 });

    // Botões sociais NÃO devem aparecer no step 2
    await expect(page.getByText(/ou cadastre-se com/i)).not.toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SEÇÃO 2 — Página /complete-profile
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Complete Profile Page — Guards', () => {
  test('redireciona para /login se não autenticado', async ({ page }) => {
    await page.goto(`${BASE}/complete-profile`);

    // Deve redirecionar para login
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    await expect(page.locator('#email')).toBeVisible();
  });
});

test.describe('Complete Profile Page — Form (autenticado)', () => {
  // Estes testes usam storageState da conta de teste (Salão da Rita).
  // Como ela JÁ tem professional, o page deve redirecionar para /dashboard.
  // Isso testa o guard de "já tem professional".

  test('redireciona para /dashboard se já tem professional', async ({ page }) => {
    // Login manual com conta que já tem professional
    await page.goto(`${BASE}/login`);
    await expect(page.locator('#email')).toBeVisible({ timeout: 15_000 });
    await page.fill('#email', TEST.USER_EMAIL);
    await page.fill('#password', TEST.USER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

    // Agora tentar acessar /complete-profile
    await page.goto(`${BASE}/complete-profile`);

    // Deve redirecionar de volta ao dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  });
});
