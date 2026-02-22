/**
 * Navegação e Consistência de UX
 *
 * Selectors baseados na implementação real do layout:
 *  - Sidebar desktop: <aside> → <nav> → <Link href="...">
 *  - Mobile bottom nav: <nav class="md:hidden fixed bottom-0 ..."> (MobileNav.tsx)
 *  - Mobile Sheet: SheetTrigger → <button>Menu</button> → <SheetContent role="dialog">
 *
 * O projeto 'navigation' usa storageState do auth-setup, sem login manual.
 *
 * Cenários:
 *  1. Links do sidebar navegam para as páginas corretas (desktop)
 *  2. Logo CircleHood retorna a /dashboard a partir de qualquer página
 *  3. Link externo "Ver minha página" tem target="_blank" + rel seguro
 *  4. Deep links funcionam sem redirecionar para /login
 *  5. Botão Voltar do browser funciona entre páginas
 *  6. Breadcrumbs (skip automático se não implementado)
 *  7. Bottom nav mobile aparece em tela pequena, sidebar fica oculta
 *  8. Botão Menu abre Sheet com links adicionais
 *  9. Clicar link no Sheet navega e fecha o menu
 * 10. Link ativo no bottom nav tem classe text-primary
 * 11. Modal de serviço fecha sem mudar URL
 */
import { test, expect } from '@playwright/test';
import { TEST } from '../helpers/config';

const BASE = TEST.BASE_URL;

// ─── 1–3: Sidebar desktop ────────────────────────────────────────────────────

test.describe('Sidebar — Desktop', () => {
  test('links principais navegam para a página correta', async ({ page }) => {
    // Rotas do BASE_NAV_ITEMS no layout.tsx — headings confirmados nos page.tsx
    const routes = [
      { href: '/services',       heading: 'Serviços'                    },
      { href: '/bookings',       heading: 'Agendamentos'                },
      { href: '/schedule',       heading: 'Horários'                    },
      { href: '/settings',       heading: 'Configurações'               },
      { href: '/whatsapp-config',heading: /Configuração WhatsApp/i      },
      { href: '/my-page',        heading: 'Minha Página'                },
    ];

    for (const route of routes) {
      await page.goto(`${BASE}/dashboard`);
      // Sidebar: aside → nav → Link (único aside no layout)
      await page.locator(`aside nav a[href="${route.href}"]`).click();
      await expect(page).toHaveURL(new RegExp(route.href + '$'));
      await expect(page.locator('h1').first()).toContainText(route.heading, { timeout: 15_000 });
      // Sem erro de servidor
      await expect(page.locator('body')).not.toContainText(/500|erro interno do servidor/i);
    }
  });

  test('logo CircleHood retorna para /dashboard a partir de qualquer página', async ({ page }) => {
    for (const url of ['/services', '/bookings', '/settings', '/whatsapp-config']) {
      await page.goto(`${BASE}${url}`);
      // aside > Link href="/dashboard" com texto "CircleHood" (layout.tsx linha 74)
      await page.locator('aside a[href="/dashboard"]').first().click();
      await expect(page).toHaveURL(`${BASE}/dashboard`);
    }
  });

  test('link "Ver minha página pública" tem target="_blank" e rel seguro', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    // aside > a[target="_blank"] (layout.tsx linha 103–108)
    const link = page.locator('aside a[target="_blank"]').first();
    await expect(link).toBeVisible({ timeout: 15_000 });
    const rel = await link.getAttribute('rel');
    // rel deve conter "noopener" ou "noreferrer" (segurança)
    expect(rel).toMatch(/noopener|noreferrer/);
    console.log(`✅ Link externo: ${await link.getAttribute('href')} | rel="${rel}"`);
  });
});

// ─── 4: Deep links ───────────────────────────────────────────────────────────

test.describe('Deep Links — Acesso Direto', () => {
  test('páginas internas carregam com sessão sem redirecionar para /login', async ({ page }) => {
    const deepLinks = [
      { url: '/bookings',  heading: 'Agendamentos'  },
      { url: '/services',  heading: 'Serviços'      },
      { url: '/settings',  heading: 'Configurações' },
      { url: '/schedule',  heading: 'Horários'      },
      { url: '/my-page',   heading: 'Minha Página'  },
    ];

    for (const link of deepLinks) {
      await page.goto(`${BASE}${link.url}`);
      // Não deve redirecionar para login
      await expect(page).not.toHaveURL(/\/login/);
      // Heading deve estar visível
      await expect(page.locator('h1').first()).toContainText(link.heading, { timeout: 15_000 });
    }
  });

  test('/dashboard carrega saudação e métricas sem erro 500', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    // data-testid="dashboard-welcome" (dashboard/page.tsx linha 158)
    await expect(page.locator('[data-testid="dashboard-welcome"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('body')).not.toContainText(/500/);
  });
});

// ─── 5: Browser back button ──────────────────────────────────────────────────

test.describe('Botão Voltar do Browser', () => {
  test('goBack após navegar pelo sidebar retorna à página anterior', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.locator('aside nav a[href="/services"]').click();
    await expect(page).toHaveURL(/\/services$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('goBack após dois saltos funciona corretamente', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);
    await page.locator('aside nav a[href="/services"]').click();
    await expect(page).toHaveURL(/\/services$/);

    await page.locator('aside nav a[href="/bookings"]').click();
    await expect(page).toHaveURL(/\/bookings$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/services$/);

    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

// ─── 6: Breadcrumbs (skip se não implementado) ───────────────────────────────

test.describe('Breadcrumbs', () => {
  test('breadcrumbs mostram caminho correto (skip se não implementado)', async ({ page }) => {
    await page.goto(`${BASE}/services`);

    const count = await page
      .locator('[data-testid="breadcrumb"], nav[aria-label="breadcrumb"]')
      .count();

    if (count === 0) {
      // Breadcrumbs não foram implementados ainda — documentar sem falhar
      test.skip(true, 'Breadcrumbs não implementados ainda');
      return;
    }

    const bc = page
      .locator('[data-testid="breadcrumb"], nav[aria-label="breadcrumb"]')
      .first();
    await expect(bc).toContainText('Serviços');

    // Link "Dashboard" no breadcrumb deve navegar de volta
    const dashLink = bc.locator('a').filter({ hasText: /dashboard|painel/i });
    if (await dashLink.count() > 0) {
      await dashLink.first().click();
      await expect(page).toHaveURL(/\/dashboard$/);
    }
  });
});

// ─── 7–10: Mobile menu ───────────────────────────────────────────────────────

test.describe('Mobile Menu (bottom nav + Sheet)', () => {
  // Mobile: 375×667 (iPhone SE) — sidebar oculta, bottom nav visível
  test.use({ viewport: { width: 375, height: 667 } });

  test('bottom nav aparece em mobile e sidebar fica oculta', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);

    // nav.md:hidden (MobileNav.tsx) — visible em 375px (md: não ativo)
    // Selector: nav com classe md:hidden — em CSS, colon requer escape
    const bottomNavLink = page.locator('nav.md\\:hidden a[href="/bookings"]');
    await expect(bottomNavLink).toBeVisible({ timeout: 15_000 });

    // aside.hidden.md:flex — hidden por display:none em mobile
    await expect(page.locator('aside')).not.toBeVisible();
  });

  test('botão Menu abre Sheet com links adicionais', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);

    // SheetTrigger: <button> com texto "Menu" no bottom nav
    const menuBtn = page.getByRole('button').filter({ hasText: 'Menu' });
    await expect(menuBtn).toBeVisible({ timeout: 15_000 });
    await menuBtn.click();

    // Sheet abre como role="dialog" (SheetContent)
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    // MENU_ITEMS em MobileNav.tsx incluem estes links
    await expect(sheet.locator('a[href="/settings"]')).toBeVisible();
    await expect(sheet.locator('a[href="/whatsapp-config"]')).toBeVisible();
    await expect(sheet.locator('a[href="/analytics"]')).toBeVisible();
  });

  test('clicar link no Sheet navega e fecha o menu', async ({ page }) => {
    await page.goto(`${BASE}/dashboard`);

    await page.getByRole('button').filter({ hasText: 'Menu' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible({ timeout: 5_000 });

    // Clicar em Configurações → Sheet fecha e URL muda
    await sheet.locator('a[href="/settings"]').click();

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.locator('h1').first()).toContainText('Configurações', { timeout: 15_000 });
  });

  test('link ativo no bottom nav tem classe text-primary, inativo tem text-muted-foreground', async ({ page }) => {
    // Em /services: link "Serviços" ativo, "Agendamentos" inativo
    // MobileNav.tsx: isActive = pathname === item.href → 'text-primary' : 'text-muted-foreground'
    await page.goto(`${BASE}/services`);

    // Bottom nav tem spans com text-[10px] — discrimina do sidebar (texto direto, sem span)
    const activeLink = page.locator('nav.md\\:hidden a[href="/services"]');
    await expect(activeLink).toBeVisible({ timeout: 15_000 });
    const activeCls = await activeLink.getAttribute('class');
    expect(activeCls).toContain('text-primary');
    console.log(`✅ Link ativo classes: ${activeCls}`);

    const inactiveLink = page.locator('nav.md\\:hidden a[href="/bookings"]');
    const inactiveCls = await inactiveLink.getAttribute('class');
    expect(inactiveCls).not.toContain('text-primary');
    expect(inactiveCls).toContain('text-muted-foreground');
  });
});

// ─── 11: Modal não altera URL ─────────────────────────────────────────────────

test.describe('Formulários e Modais', () => {
  test('modal Novo Serviço fecha sem mudar URL', async ({ page }) => {
    await page.goto(`${BASE}/services`);

    // Botão "Adicionar serviço" (03-catalog.spec.ts confirma o texto)
    const addBtn = page.getByRole('button', { name: /adicionar servi/i });
    await expect(addBtn).toBeVisible({ timeout: 15_000 });
    await addBtn.click();

    // Modal abre (confirmado no test 03-catalog)
    await expect(page.getByRole('heading', { name: /novo servi/i })).toBeVisible({ timeout: 8_000 });

    // Preencher campo nome
    await page.locator('#name').fill('Teste de Navegação');
    await expect(page.locator('#name')).toHaveValue('Teste de Navegação');

    // Fechar com Escape — URL não deve mudar
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: /novo servi/i })).not.toBeVisible({ timeout: 5_000 });
    await expect(page).toHaveURL(`${BASE}/services`);
  });
});
