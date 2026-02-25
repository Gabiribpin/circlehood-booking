/**
 * Testes E2E — Páginas Legais (Política de Privacidade + Termos de Uso)
 *
 * Cobre as páginas implementadas em src/app/[locale]/(public)/privacy e /terms.
 * São páginas estáticas (SSR com i18n) — nenhum dado é gravado no banco.
 *
 * Locales testados: pt-BR, en-US, es-ES.
 *
 * Nota: o footer da landing page não contém links legais.
 * Os links /privacy e /terms estão:
 *  - No checkbox de termos da página /register
 *  - Na própria página de privacy (link para /terms) e vice-versa
 */
import { test, expect } from '@playwright/test';
import { TEST } from './helpers/config';

const BASE = TEST.BASE_URL;

// ─── Política de Privacidade ──────────────────────────────────────────────────

test.describe('Política de Privacidade — PT-BR', () => {
  test('carrega com título em português', async ({ page }) => {
    await page.goto(`${BASE}/pt-BR/privacy`);
    await expect(page.locator('h1').first()).toContainText('Política de Privacidade', { timeout: 15_000 });
    await expect(page.locator('body')).not.toContainText(/500|erro interno/i);
  });

  test('botão Voltar ao início leva à home', async ({ page }) => {
    await page.goto(`${BASE}/pt-BR/privacy`);
    // Dois botões "Voltar" existem — header e footer da página legal
    const backBtn = page.getByRole('link', { name: /voltar ao início|back|home/i }).first();
    await expect(backBtn).toBeVisible({ timeout: 10_000 });
  });

  test('link para Termos de Uso visível', async ({ page }) => {
    await page.goto(`${BASE}/pt-BR/privacy`);
    // Rodapé da página tem link para /terms
    await expect(page.getByRole('link', { name: /termos de uso/i })).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Privacy Policy — EN-US', () => {
  test('carrega com título em inglês', async ({ page }) => {
    await page.goto(`${BASE}/en-US/privacy`);
    await expect(page.locator('h1').first()).toContainText('Privacy Policy', { timeout: 15_000 });
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i);
  });
});

test.describe('Política de Privacidad — ES-ES', () => {
  test('carrega com título em espanhol', async ({ page }) => {
    await page.goto(`${BASE}/es-ES/privacy`);
    await expect(page.locator('h1').first()).toContainText('Política de Privacidad', { timeout: 15_000 });
    await expect(page.locator('body')).not.toContainText(/500|error interno/i);
  });
});

// ─── Termos de Uso ────────────────────────────────────────────────────────────

test.describe('Termos de Uso — PT-BR', () => {
  test('carrega com título em português', async ({ page }) => {
    await page.goto(`${BASE}/pt-BR/terms`);
    await expect(page.locator('h1').first()).toContainText('Termos de Uso', { timeout: 15_000 });
    await expect(page.locator('body')).not.toContainText(/500|erro interno/i);
  });

  test('botão Voltar ao início leva à home', async ({ page }) => {
    await page.goto(`${BASE}/pt-BR/terms`);
    const backBtn = page.getByRole('link', { name: /voltar ao início|back|home/i }).first();
    await expect(backBtn).toBeVisible({ timeout: 10_000 });
  });

  test('link para Política de Privacidade visível', async ({ page }) => {
    await page.goto(`${BASE}/pt-BR/terms`);
    await expect(page.getByRole('link', { name: /política de privacidade/i }).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Terms of Use — EN-US', () => {
  test('carrega com título em inglês', async ({ page }) => {
    await page.goto(`${BASE}/en-US/terms`);
    await expect(page.locator('h1').first()).toContainText('Terms of Use', { timeout: 15_000 });
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i);
  });
});

test.describe('Términos de Uso — ES-ES', () => {
  test('carrega com título em espanhol', async ({ page }) => {
    await page.goto(`${BASE}/es-ES/terms`);
    await expect(page.locator('h1').first()).toContainText('Términos de Uso', { timeout: 15_000 });
    await expect(page.locator('body')).not.toContainText(/500|error interno/i);
  });
});

// ─── Links internos entre páginas legais ─────────────────────────────────────

test.describe('Cross-links entre páginas legais', () => {
  test('privacy → link para terms navega corretamente', async ({ page }) => {
    await page.goto(`${BASE}/pt-BR/privacy`);
    // O rodapé da página de privacy tem um link para /terms
    const termsLink = page.getByRole('link', { name: /termos de uso/i }).last();
    await expect(termsLink).toBeVisible({ timeout: 10_000 });
    const href = await termsLink.getAttribute('href');
    expect(href).toMatch(/\/terms/i);
  });

  test('terms → link para privacy navega corretamente', async ({ page }) => {
    await page.goto(`${BASE}/pt-BR/terms`);
    // A página de terms tem um link para /privacy (no corpo e no rodapé)
    const privacyLink = page.getByRole('link', { name: /política de privacidade/i }).last();
    await expect(privacyLink).toBeVisible({ timeout: 10_000 });
    const href = await privacyLink.getAttribute('href');
    expect(href).toMatch(/\/privacy/i);
  });

  test('página /register tem links para /terms e /privacy no checkbox', async ({ page }) => {
    await page.goto(`${BASE}/register`);

    // Avançar para step 2 (onde fica o checkbox de termos)
    await page.fill('#email', `legal-link-test-${Date.now()}@test.io`);
    await page.fill('#password', 'ValidoLegal1!');
    await page.click('button:has-text("Continuar")');

    // Aguardar step 2
    await expect(page.locator('#businessName')).toBeVisible({ timeout: 15_000 });

    // O label do checkbox deve ter link para /terms
    const termsLink = page.locator('label[for="terms"] a[href*="/terms"]');
    await expect(termsLink).toBeVisible({ timeout: 5_000 });

    // E link para /privacy
    const privacyLink = page.locator('label[for="terms"] a[href*="/privacy"]');
    await expect(privacyLink).toBeVisible({ timeout: 5_000 });

    // Ambos devem abrir em nova aba
    expect(await termsLink.getAttribute('target')).toBe('_blank');
    expect(await privacyLink.getAttribute('target')).toBe('_blank');
  });
});
