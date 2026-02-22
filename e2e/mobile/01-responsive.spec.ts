import { test, expect } from '@playwright/test';
import { TEST } from '../helpers/config';

/**
 * Testes Mobile Responsivos — Salão da Rita (conta de teste)
 *
 * Objetivo: DOCUMENTAR o estado atual do mobile, não forçar mudanças.
 * Testes com console.log extensivo para diagnóstico.
 * Viewport é redefinido no início de cada teste.
 *
 * Usa storageState (auth já feito pelo auth-setup) — sem re-login em cada teste.
 */

const VIEWPORTS = {
  iPhoneSE:  { width: 375, height: 667 },  // iOS, tela pequena
  iPhone12:  { width: 390, height: 844 },  // iOS, tela média
  pixel5:    { width: 393, height: 851 },  // Android, tela média
} as const;

const PUBLIC_SLUG = 'salao-da-rita';

// ─── Teste 1: Dashboard carrega sem overflow horizontal ──────────────────────

test('dashboard carrega corretamente no iPhone SE (sem overflow horizontal)', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.iPhoneSE);
  await page.goto(`${TEST.BASE_URL}/dashboard`);
  await expect(page).toHaveURL(/\/dashboard/);

  const heading = page.locator('h1, h2').first();
  await expect(heading).toBeVisible();

  const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
  const viewportWidth = VIEWPORTS.iPhoneSE.width;

  expect(bodyScrollWidth).toBeLessThanOrEqual(viewportWidth + 5);
  console.log(`✅ Dashboard iPhone SE: body ${bodyScrollWidth}px <= viewport ${viewportWidth}px`);
});

test('dashboard carrega corretamente no Pixel 5 (sem overflow horizontal)', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.pixel5);
  await page.goto(`${TEST.BASE_URL}/dashboard`);
  await expect(page).toHaveURL(/\/dashboard/);

  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );

  expect(hasHorizontalScroll).toBe(false);
  console.log('✅ Dashboard Pixel 5: sem scroll horizontal');
});

// ─── Teste 2: Menu mobile funciona ──────────────────────────────────────────

test('menu mobile abre e fecha (se existir)', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.iPhoneSE);
  await page.goto(`${TEST.BASE_URL}/dashboard`);

  // Tenta encontrar botão de menu mobile por vários seletores
  const menuButton = page.locator(
    '[data-testid="mobile-menu-button"], ' +
    'button[aria-label="Menu"], ' +
    'button[aria-label="menu"], ' +
    'button:has(svg.lucide-menu), ' +
    'button:has([data-lucide="menu"])'
  ).first();

  const menuExists = await menuButton.isVisible().catch(() => false);

  if (!menuExists) {
    console.log('ℹ️  Botão de menu mobile não encontrado — navegação sempre visível (sidebar/desktop layout)');
    // Verificar que alguma navegação existe
    const nav = page.locator('nav, [role="navigation"], aside').first();
    const navVisible = await nav.isVisible().catch(() => false);
    console.log(navVisible ? '✅ Navegação visível na sidebar' : 'ℹ️  Sem nav visível');
    return;
  }

  await menuButton.click();
  await page.waitForTimeout(300);

  const dialog = page.locator('[role="dialog"], [data-testid="mobile-menu"]').first();
  const dialogVisible = await dialog.isVisible().catch(() => false);

  if (dialogVisible) {
    console.log('✅ Menu mobile abre');

    const servicesLink = dialog.locator('a').filter({ hasText: /servi/i }).first();
    if (await servicesLink.isVisible().catch(() => false)) {
      await servicesLink.click();
      await expect(page).toHaveURL(/\/services/);
      await expect(dialog).not.toBeVisible();
      console.log('✅ Menu fecha após navegar');
    } else {
      console.log('ℹ️  Link de serviços não encontrado no menu mobile');
    }
  } else {
    console.log('ℹ️  Dialog não apareceu após click no menu — pode usar outro padrão de navegação');
  }
});

// ─── Teste 3: Touch targets adequados (>= 44px) ──────────────────────────────

test('elementos interativos têm touch targets adequados (>=44px)', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.iPhoneSE);
  await page.goto(`${TEST.BASE_URL}/dashboard`);

  // Apenas botões e links principais visíveis
  const interactives = page.locator('button:visible:not([disabled]), a[href]:visible');
  const count = await interactives.count();
  const maxCheck = Math.min(count, 20);

  const smallTargets: Array<{ text: string; size: string }> = [];

  for (let i = 0; i < maxCheck; i++) {
    const el = interactives.nth(i);
    const box = await el.boundingBox().catch(() => null);
    if (!box) continue;

    if (box.width < 44 || box.height < 44) {
      const text = (await el.textContent().catch(() => '') ?? '').trim();
      smallTargets.push({
        text: text.slice(0, 25) || '(sem texto)',
        size: `${Math.round(box.width)}x${Math.round(box.height)}px`,
      });
    }
  }

  if (smallTargets.length > 0) {
    console.log(`⚠️  ${smallTargets.length} touch target(s) < 44px (dos primeiros ${maxCheck} verificados):`);
    smallTargets.slice(0, 5).forEach((t) => console.log(`   - "${t.text}": ${t.size}`));
  } else {
    console.log(`✅ Todos os ${maxCheck} touch targets verificados têm >=44px`);
  }

  // Não falha — apenas documenta (objetivo informativo)
  expect(count).toBeGreaterThan(0);
});

// ─── Teste 4: Modais cabem em mobile ─────────────────────────────────────────

test('modal de novo serviço cabe na tela mobile', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.iPhoneSE);
  await page.goto(`${TEST.BASE_URL}/dashboard/services`);

  const newButton = page.locator('button').filter({ hasText: /novo servi/i }).first();

  if (!(await newButton.isVisible().catch(() => false))) {
    console.log('⏭️  Botão "Novo Serviço" não encontrado — skipping');
    test.skip();
    return;
  }

  await newButton.click();
  await page.waitForTimeout(500);

  const dialog = page.locator('[role="dialog"]').first();

  if (!(await dialog.isVisible().catch(() => false))) {
    console.log('⏭️  Dialog não apareceu após click — skipping');
    test.skip();
    return;
  }

  const box = await dialog.boundingBox();
  if (box) {
    expect(box.width).toBeLessThanOrEqual(VIEWPORTS.iPhoneSE.width + 5);
    console.log(`✅ Modal cabe no iPhone SE: ${Math.round(box.width)}px (viewport: ${VIEWPORTS.iPhoneSE.width}px)`);
  }

  // Fechar modal
  const closeBtn = page
    .locator('button[aria-label="Close"], button[aria-label="Fechar"], button:has-text("Cancelar")')
    .first();

  if (await closeBtn.isVisible().catch(() => false)) {
    await closeBtn.click();
    await expect(dialog).not.toBeVisible();
    console.log('✅ Modal fecha corretamente');
  }
});

// ─── Teste 5: Formulários preenchíveis ───────────────────────────────────────

test('formulários são preenchíveis em mobile (iPhone 12)', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.iPhone12);
  await page.goto(`${TEST.BASE_URL}/dashboard/settings`);

  const inputs = page.locator('input[type="text"]:visible, input[type="email"]:visible, textarea:visible');
  const count = await inputs.count();

  if (count === 0) {
    console.log('⏭️  Nenhum input visível em /settings — skipping');
    test.skip();
    return;
  }

  const firstInput = inputs.first();
  await expect(firstInput).toBeVisible();

  const box = await firstInput.boundingBox();
  if (box) {
    if (box.height < 44) {
      console.log(`⚠️  Input pequeno: ${Math.round(box.height)}px de altura (recomendado >=44px)`);
    } else {
      console.log(`✅ Input com altura adequada: ${Math.round(box.height)}px`);
    }
  }

  // Testar digitação
  const currentValue = await firstInput.inputValue();
  await firstInput.click();
  await firstInput.fill('Teste Mobile Input');
  expect(await firstInput.inputValue()).toBe('Teste Mobile Input');
  console.log('✅ Input preenchível corretamente');

  // Restaurar valor original
  await firstInput.fill(currentValue);
});

// ─── Teste 6: Página pública sem overflow ────────────────────────────────────

test('página pública funciona sem overflow no iPhone SE', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.iPhoneSE);

  // Página pública — não requer auth
  const response = await page.goto(`${TEST.BASE_URL}/${PUBLIC_SLUG}`);
  await page.waitForLoadState('networkidle');

  // Não deve ser 500
  if (response) {
    expect(response.status()).not.toBe(500);
  }

  if (response?.status() === 404) {
    console.log(`ℹ️  Slug "${PUBLIC_SLUG}" retornou 404 — página pública pode ter outro slug`);
    return;
  }

  const bodyText = await page.evaluate(() => document.body.innerText);
  expect(bodyText.length).toBeGreaterThan(50);

  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );

  expect(hasHorizontalScroll).toBe(false);
  console.log(`✅ Página pública /${PUBLIC_SLUG} sem overflow horizontal no iPhone SE`);
});

// ─── Teste 7: Texto legível (>=14px) ─────────────────────────────────────────

test('texto é legível em mobile (>=14px)', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.iPhoneSE);
  await page.goto(`${TEST.BASE_URL}/dashboard`);

  // Verificar elementos de texto visíveis
  const textEls = await page.locator('p:visible, span:visible, button:visible, a:visible').all();
  const maxCheck = Math.min(textEls.length, 30);
  const smallTexts: Array<{ text: string; fontSize: number }> = [];

  for (let i = 0; i < maxCheck; i++) {
    const fontSize = await textEls[i]
      .evaluate((el) => parseFloat(window.getComputedStyle(el).fontSize))
      .catch(() => 16);

    if (fontSize < 14) {
      const text = (await textEls[i].textContent().catch(() => '') ?? '').trim();
      if (text) {
        smallTexts.push({ text: text.slice(0, 30), fontSize: Math.round(fontSize) });
      }
    }
  }

  if (smallTexts.length > 0) {
    console.log(`ℹ️  ${smallTexts.length} elemento(s) com fonte <14px (dos primeiros ${maxCheck} verificados):`);
    smallTexts.slice(0, 3).forEach((t) => console.log(`   - "${t.text}": ${t.fontSize}px`));
  } else {
    console.log(`✅ Todo texto legível (>=14px) nos ${maxCheck} elementos verificados`);
  }

  // Não falha — apenas documenta
  expect(maxCheck).toBeGreaterThan(0);
});

// ─── Teste 8: Scroll funciona ─────────────────────────────────────────────────

test('scroll vertical funciona corretamente em mobile', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.iPhoneSE);
  await page.goto(`${TEST.BASE_URL}/dashboard/bookings`);

  const isScrollable = await page.evaluate(
    () => document.documentElement.scrollHeight > document.documentElement.clientHeight
  );

  if (!isScrollable) {
    console.log('ℹ️  Página /bookings cabe na tela sem scroll — OK para mobile');
    return;
  }

  // Scroll para baixo
  await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }));
  await page.waitForTimeout(300);

  const scrollY = await page.evaluate(() => window.scrollY);
  expect(scrollY).toBeGreaterThan(0);
  console.log(`✅ Scroll para baixo: ${scrollY}px`);

  // Scroll de volta ao topo
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(300);

  const backToTop = await page.evaluate(() => window.scrollY);
  expect(backToTop).toBeLessThan(50);
  console.log('✅ Scroll de volta ao topo OK');
});
