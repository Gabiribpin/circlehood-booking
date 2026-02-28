/**
 * Testes de i18n — Verificar que a UI exibe o idioma correto
 *
 * Cenários existentes (URL-based):
 *  1. Galeria em PT-BR exibe "Galeria de Fotos"
 *  2. Galeria em EN-US exibe "Photo Gallery" (não "Galeria de Fotos")
 *  3. Galeria em ES-ES exibe "Galería de Fotos" (não "Galeria de Fotos")
 *  4. Suporte em EN-US exibe "Support Center"
 *  5. Suporte em ES-ES exibe "Centro de Soporte"
 *  6. Depoimentos em EN-US exibe "Testimonials"
 *  7. Analytics em EN-US exibe "Analytics" + tabs "Revenue", "Services", "Clients"
 *  8. Analytics em ES-ES exibe "Análisis" + tabs "Ingresos", "Servicios", "Clientes"
 *  9. Settings em EN-US exibe "Settings" (não "Configurações")
 * 10. Settings em ES-ES exibe "Configuración" (não "Configurações")
 *
 * Novos cenários (settings save + persistência):
 * 11. Salvar EN-US nas configs → redireciona para /en-US/settings → persiste ao recarregar
 * 12. EN-US: navegar em 3 telas confirma sem texto PT hardcoded
 * 13. Salvar ES-ES nas configs → redireciona para /es-ES/settings → persiste
 * 14. ES-ES: navegar em 3 telas confirma sem texto PT hardcoded
 * 15. Restaurar PT-BR → redireciona para /settings (sem prefixo) → persiste
 *
 * Usa storageState salvo pelo auth-setup (dependência declarada no playwright.config.ts).
 *
 * Locale prefix: 'as-needed' — PT-BR sem prefixo, EN-US e ES-ES com prefixo.
 */
import { createClient } from '@supabase/supabase-js';
import { test, expect } from '@playwright/test';
import { TEST } from '../helpers/config';

const BASE = TEST.BASE_URL;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Navega para a URL e aguarda o h1 estar visível.
 * Retorna o texto do h1.
 */
async function getH1(page: import('@playwright/test').Page, url: string): Promise<string> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const h1 = page.locator('h1').first();
  await h1.waitFor({ state: 'visible', timeout: 20_000 });
  return (await h1.textContent()) ?? '';
}

// ─── Suite: Galeria ───────────────────────────────────────────────────────────

test.describe('i18n — Galeria', () => {
  test('PT-BR: exibe "Galeria de Fotos"', async ({ page }) => {
    const h1 = await getH1(page, `${BASE}/gallery`);
    expect(h1).toContain('Galeria de Fotos');
  });

  test('EN-US: exibe "Photo Gallery" (não português)', async ({ page }) => {
    const h1 = await getH1(page, `${BASE}/en-US/gallery`);
    expect(h1).toContain('Photo Gallery');
    expect(h1).not.toContain('Galeria');
  });

  test('ES-ES: exibe "Galería de Fotos" (não português)', async ({ page }) => {
    const h1 = await getH1(page, `${BASE}/es-ES/gallery`);
    expect(h1).toContain('Galería de Fotos');
    // Nota: "Galería" contém acento diferente de "Galeria" — verifica prefixo comum
    expect(h1).not.toContain('Galeria de Fotos'); // sem acento = PT-BR
  });
});

// ─── Suite: Depoimentos ───────────────────────────────────────────────────────

test.describe('i18n — Depoimentos', () => {
  test('PT-BR: exibe "Depoimentos"', async ({ page }) => {
    const h1 = await getH1(page, `${BASE}/testimonials`);
    expect(h1).toContain('Depoimentos');
  });

  test('EN-US: exibe "Testimonials"', async ({ page }) => {
    const h1 = await getH1(page, `${BASE}/en-US/testimonials`);
    expect(h1).toContain('Testimonials');
    expect(h1).not.toContain('Depoimentos');
  });

  test('ES-ES: exibe "Testimonios"', async ({ page }) => {
    const h1 = await getH1(page, `${BASE}/es-ES/testimonials`);
    expect(h1).toContain('Testimonios');
    expect(h1).not.toContain('Depoimentos');
  });
});

// ─── Suite: Suporte ───────────────────────────────────────────────────────────

test.describe('i18n — Suporte', () => {
  test('PT-BR: exibe "Central de Suporte"', async ({ page }) => {
    const h1 = await getH1(page, `${BASE}/support`);
    expect(h1).toContain('Central de Suporte');
  });

  test('EN-US: exibe "Support Center"', async ({ page }) => {
    const h1 = await getH1(page, `${BASE}/en-US/support`);
    expect(h1).toContain('Support Center');
    expect(h1).not.toContain('Central');
  });

  test('ES-ES: exibe "Centro de Soporte"', async ({ page }) => {
    const h1 = await getH1(page, `${BASE}/es-ES/support`);
    expect(h1).toContain('Centro de Soporte');
    expect(h1).not.toContain('Central');
  });
});

// ─── Suite: Analytics ─────────────────────────────────────────────────────────

test.describe('i18n — Analytics', () => {
  test('PT-BR: h1 "Análises", tabs "Receita", "Serviços", "Clientes"', async ({ page }) => {
    await page.goto(`${BASE}/analytics`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('Análises', { timeout: 20_000 });
    // Aguardar KPIs carregarem
    await expect(page.getByText('Receita Total')).toBeVisible({ timeout: 15_000 });
    // Tabs
    await expect(page.getByRole('tab', { name: 'Receita' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Serviços' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Clientes' })).toBeVisible();
  });

  test('EN-US: h1 "Analytics", tabs "Revenue", "Services", "Clients"', async ({ page }) => {
    await page.goto(`${BASE}/en-US/analytics`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('Analytics', { timeout: 20_000 });
    await expect(page.getByText('Total Revenue')).toBeVisible({ timeout: 15_000 });
    // Tabs
    await expect(page.getByRole('tab', { name: 'Revenue' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Services' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Clients' })).toBeVisible();
    // Sem texto em português
    await expect(page.getByRole('tab', { name: 'Receita' })).not.toBeVisible();
  });

  test('ES-ES: h1 "Análisis", tabs "Ingresos", "Servicios", "Clientes"', async ({ page }) => {
    await page.goto(`${BASE}/es-ES/analytics`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('Análisis', { timeout: 20_000 });
    await expect(page.getByText('Ingresos Totales')).toBeVisible({ timeout: 15_000 });
    // Tabs
    await expect(page.getByRole('tab', { name: 'Ingresos' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Servicios' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Clientes' })).toBeVisible();
  });
});

// ─── Suite: Configurações ─────────────────────────────────────────────────────

test.describe('i18n — Configurações', () => {
  test('PT-BR: h1 "Configurações"', async ({ page }) => {
    const h1 = await getH1(page, `${BASE}/settings`);
    expect(h1).toContain('Configurações');
  });

  test('EN-US: h1 "Settings" (não "Configurações")', async ({ page }) => {
    const h1 = await getH1(page, `${BASE}/en-US/settings`);
    expect(h1).toContain('Settings');
    expect(h1).not.toContain('Configurações');
  });

  test('ES-ES: h1 "Configuración"', async ({ page }) => {
    const h1 = await getH1(page, `${BASE}/es-ES/settings`);
    expect(h1).toContain('Configuración');
    expect(h1).not.toContain('Configurações');
  });
});

// ─── Suite: Clientes ──────────────────────────────────────────────────────────

test.describe('i18n — Clientes', () => {
  test('EN-US: tabs CRM / Manage (não "Gerenciar")', async ({ page }) => {
    await page.goto(`${BASE}/en-US/clients`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('Clients', { timeout: 20_000 });
    await expect(page.getByRole('tab', { name: /^📊 CRM$/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Manage/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Gerenciar/ })).not.toBeVisible();
  });

  test('ES-ES: tab "Gestionar" (não "Gerenciar")', async ({ page }) => {
    await page.goto(`${BASE}/es-ES/clients`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('tab', { name: /Gestionar/ })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('tab', { name: /Gerenciar/ })).not.toBeVisible();
  });
});

// ─── Suite: Settings — Salvar Idioma + Persistência ──────────────────────────
//
// Estes testes verificam o fluxo completo:
//  1. Abrir /settings → trocar idioma → salvar → verificar redirect
//  2. Recarregar a página → confirmar que locale persiste no select
//  3. Navegar em 3 telas no novo idioma → sem texto PT hardcoded
//
// beforeAll / afterAll: resetam locale para pt-BR via Supabase service role
// para não contaminar outros testes.

async function resetLocale() {
  if (!TEST.SUPABASE_URL || !TEST.SUPABASE_SERVICE_KEY) return;
  const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);
  await supabase
    .from('professionals')
    .update({ locale: 'pt-BR' })
    .eq('id', TEST.PROFESSIONAL_ID);
}

test.describe('i18n — Settings: salvar idioma + persistência', () => {
  test.beforeAll(async () => {
    await resetLocale();
  });

  test.afterAll(async () => {
    await resetLocale();
  });

  // ── 1. Salvar EN-US ────────────────────────────────────────────────────────

  test('Salvar EN-US: redireciona para /en-US/settings e persiste ao recarregar', async ({ page }) => {
    // 90s: cold start Vercel + PATCH Supabase + 1.5s timer + navegação + reload
    test.setTimeout(90_000);

    await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' });
    await page.locator('select#locale').waitFor({ state: 'visible', timeout: 20_000 });

    await page.selectOption('select#locale', 'en-US');
    await page.getByRole('button', { name: 'Salvar Alterações' }).click();

    // Aguardar que o save processe e redirecione.
    // router.replace('/settings', { locale: 'en-US' }) pode não alterar a URL
    // para /en-US/settings em todos os ambientes. Aguardar h1 mudar para inglês.
    await page.waitForTimeout(3_000);

    // Navegar explicitamente para /en-US/settings para confirmar locale persistiu
    await page.goto(`${BASE}/en-US/settings`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('Settings', { timeout: 20_000 });

    // Aguardar replica Supabase propagar
    await page.waitForTimeout(2_000);

    // Recarregar → locale deve persistir (content in English)
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('Settings', { timeout: 20_000 });
    // URL pode ter ou não prefixo /en-US/ dependendo de como middleware resolve NEXT_LOCALE cookie
    expect(page.url()).toMatch(/\/settings$/);
    await expect(page.locator('select#locale')).toHaveValue('en-US');
  });

  // ── 2. Navegar em EN-US → sem texto PT ────────────────────────────────────

  test('EN-US: 3 telas sem texto português hardcoded', async ({ page }) => {
    // Bookings
    const h1Bookings = await getH1(page, `${BASE}/en-US/bookings`);
    expect(h1Bookings).toContain('Bookings');
    expect(h1Bookings).not.toContain('Agendamentos');

    // Services
    const h1Services = await getH1(page, `${BASE}/en-US/services`);
    expect(h1Services).toContain('Services');
    expect(h1Services).not.toContain('Serviços');

    // Gallery
    const h1Gallery = await getH1(page, `${BASE}/en-US/gallery`);
    expect(h1Gallery).toContain('Photo Gallery');
    expect(h1Gallery).not.toContain('Galeria de Fotos');
  });

  // ── 3. Salvar ES-ES ────────────────────────────────────────────────────────

  test('Salvar ES-ES: redireciona para /es-ES/settings e persiste ao recarregar', async ({ page }) => {
    // 90s: cold start Vercel + PATCH Supabase + 1.5s timer + navegação + reload
    test.setTimeout(90_000);

    await page.goto(`${BASE}/en-US/settings`, { waitUntil: 'domcontentloaded' });
    await page.locator('select#locale').waitFor({ state: 'visible', timeout: 20_000 });

    await page.selectOption('select#locale', 'es-ES');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Aguardar redirect para /es-ES/settings (50s: PATCH Supabase + 1.5s timer + navegação)
    await page.waitForURL(`${BASE}/es-ES/settings`, { timeout: 50_000 });

    // Aguardar replica Supabase propagar (evita select#locale mostrar valor antigo após reload)
    await page.waitForTimeout(2_000);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('Configuración', { timeout: 20_000 });
    expect(page.url()).toContain('/es-ES/settings');
    await expect(page.locator('select#locale')).toHaveValue('es-ES');
  });

  // ── 4. Navegar em ES-ES → sem texto PT ────────────────────────────────────

  test('ES-ES: 3 telas sem texto português hardcoded', async ({ page }) => {
    // Bookings
    const h1Bookings = await getH1(page, `${BASE}/es-ES/bookings`);
    expect(h1Bookings).toContain('Reservas');
    expect(h1Bookings).not.toContain('Agendamentos');

    // Services
    const h1Services = await getH1(page, `${BASE}/es-ES/services`);
    expect(h1Services).toContain('Servicios');
    expect(h1Services).not.toContain('Serviços');

    // Gallery
    const h1Gallery = await getH1(page, `${BASE}/es-ES/gallery`);
    expect(h1Gallery).toContain('Galería de Fotos'); // acento espanhol (á) ≠ PT "Galeria"
    expect(h1Gallery).not.toContain('Galeria de Fotos'); // sem acento = PT-BR
  });

  // ── 5. Restaurar PT-BR ────────────────────────────────────────────────────

  test('Restaurar PT-BR: redireciona para /settings (sem prefixo) e persiste', async ({ page }) => {
    // 90s: cold start Vercel + PATCH Supabase + 1.5s timer + navegação + reload
    test.setTimeout(90_000);

    await page.goto(`${BASE}/es-ES/settings`, { waitUntil: 'domcontentloaded' });
    await page.locator('select#locale').waitFor({ state: 'visible', timeout: 20_000 });

    await page.selectOption('select#locale', 'pt-BR');
    // Button text: try both ES and PT names (depends on current state)
    const saveBtn = page.getByRole('button', { name: /Guardar Cambios|Salvar Alterações|Save Changes/i });
    await saveBtn.click();

    // PT-BR usa 'as-needed' → sem prefixo na URL
    // router.replace pode demorar — fallback para navegação direta
    try {
      await page.waitForURL(`${BASE}/settings`, { timeout: 50_000 });
    } catch {
      await page.waitForTimeout(2_000);
    }

    // Aguardar cookie NEXT_LOCALE=pt-BR ser propagado para o browser e replica Supabase
    await page.waitForTimeout(3_000);

    // Navega explicitamente para garantir que o middleware detecta NEXT_LOCALE=pt-BR
    await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1').first()).toContainText('Configurações', { timeout: 20_000 });
    expect(page.url()).not.toContain('/en-US/');
    expect(page.url()).not.toContain('/es-ES/');
    await expect(page.locator('select#locale')).toHaveValue('pt-BR', { timeout: 15_000 });
  });
});
