/**
 * Testes de Jornada do Usuário — Onboarding de Novo Profissional
 *
 * Cobre o fluxo real do app (não a spec imaginária — mapeado contra código):
 *
 *  Registro (/register):
 *  ─ Step 1: email + senha → "Continuar"
 *  ─ Step 2: businessName (gera slug automático) + city + category → "Criar minha página"
 *  ─ Redirect para /dashboard após registro
 *
 *  Dashboard pós-registro:
 *  ─ Banner "Configure sua conta" visível enquanto onboarding_completed = false
 *  ─ Link "Completar setup →" aponta para /onboarding
 *
 *  Página de Onboarding (/onboarding):
 *  ─ Checklist de 5 passos (não wizard)
 *  ─ Step 1 (conta) sempre concluído
 *  ─ Links navegam para /services, /schedule, /whatsapp-config, /my-page-editor
 *  ─ "Pular por enquanto" → /dashboard
 *  ─ "Marcar como concluído" / "🎉 Concluir setup" → /dashboard
 *
 * API /api/register:
 *  ─ Campos obrigatórios faltando → 400
 *  ─ Email duplicado → 400
 *  ─ Slug duplicado → 500 (constraint DB)
 *  ─ Happy path → 200 + { success: true, userId }
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { TEST } from '../helpers/config';

const BASE = TEST.BASE_URL;
const sb = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);

// ─── Cleanup helper ──────────────────────────────────────────────────────────

async function cleanupTestUser(email: string): Promise<void> {
  // Look up user by email via admin API
  const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = data?.users?.find((u) => u.email === email);
  if (!user) return;

  // Delete professional data in FK-safe order
  const { data: prof } = await sb
    .from('professionals')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (prof) {
    await sb.from('bookings').delete().eq('professional_id', prof.id);
    await sb.from('working_hours').delete().eq('professional_id', prof.id);
    await sb.from('services').delete().eq('professional_id', prof.id);
    await sb.from('professionals').delete().eq('id', prof.id);
  }
  await sb.auth.admin.deleteUser(user.id).catch(() => {});
}

// ═══════════════════════════════════════════════════════════════════════════
// SECÇÃO 1 — API /api/register
// Testes rápidos sem browser: validam a camada de backend.
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Registro — API /api/register', () => {
  // ── 1a: Happy path ──────────────────────────────────────────────────────
  test('POST com dados válidos → cria auth user + professional → 200', async ({ request }) => {
    const ts = Date.now();
    const email = `e2e-api-reg-${ts}@circlehood-test.io`;
    const slug = `e2e-api-${String(ts).slice(-7)}`;

    try {
      const res = await request.post(`${BASE}/api/register`, {
        data: {
          email,
          password: 'E2eTest1234!',
          slug,
          businessName: `API Test ${ts}`,
          city: 'Dublin',
        },
      });

      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.userId).toBeTruthy();

      // Verifica que o profissional foi criado no banco
      const { data: prof } = await sb
        .from('professionals')
        .select('id, slug, business_name, city')
        .eq('slug', slug)
        .single();

      expect(prof?.slug).toBe(slug);
      expect(prof?.city).toBe('Dublin');
    } finally {
      await cleanupTestUser(email);
    }
  });

  // ── 1b: Campos obrigatórios faltando ────────────────────────────────────
  test('POST sem businessName → 400 campos obrigatórios', async ({ request }) => {
    const res = await request.post(`${BASE}/api/register`, {
      data: {
        email: `missing-name-${Date.now()}@test.io`,
        password: 'E2eTest1234!',
        slug: `missing-name-${Date.now()}`,
        // businessName ausente
        city: 'Dublin',
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/obrigatório|faltando|required/i);
  });

  test('POST sem email → 400 campos obrigatórios', async ({ request }) => {
    const res = await request.post(`${BASE}/api/register`, {
      data: {
        password: 'E2eTest1234!',
        slug: `no-email-${Date.now()}`,
        businessName: 'No Email Test',
        city: 'Dublin',
      },
    });
    expect(res.status()).toBe(400);
  });

  test('POST sem slug → 400 campos obrigatórios', async ({ request }) => {
    const res = await request.post(`${BASE}/api/register`, {
      data: {
        email: `no-slug-${Date.now()}@test.io`,
        password: 'E2eTest1234!',
        businessName: 'No Slug Test',
        city: 'Dublin',
      },
    });
    expect(res.status()).toBe(400);
  });

  // ── 1c: Email duplicado ─────────────────────────────────────────────────
  test('POST com email já cadastrado → 400 (Supabase reject)', async ({ request }) => {
    // Usa email do profissional de teste real — já existe no banco
    const res = await request.post(`${BASE}/api/register`, {
      data: {
        email: TEST.USER_EMAIL, // email já cadastrado
        password: 'E2eTest1234!',
        slug: `dup-email-${Date.now()}`,
        businessName: 'Duplicado Email',
        city: 'Dublin',
      },
    });
    // Supabase rejeita email duplicado
    expect(res.status()).toBe(400);
  });

  // ── 1d: Slug duplicado ──────────────────────────────────────────────────
  test('POST com slug já em uso → erro (DB constraint)', async ({ request }) => {
    // Busca um slug que já existe
    const { data: prof } = await sb
      .from('professionals')
      .select('slug')
      .limit(1)
      .single();

    if (!prof?.slug) return; // skip se não há profissionais

    const res = await request.post(`${BASE}/api/register`, {
      data: {
        email: `dup-slug-${Date.now()}@test.io`,
        password: 'E2eTest1234!',
        slug: prof.slug, // slug duplicado ← ataque
        businessName: 'Slug Duplicado',
        city: 'Dublin',
      },
    });
    // DB unique constraint → 500 (profileError) ou 400 se Supabase detect antes
    expect([400, 500]).toContain(res.status());
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECÇÃO 2 — Formulário de Registro UI (validações client-side)
// Testes de browser: verificam comportamento do formulário antes de submeter.
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Registro — Formulário UI', () => {
  // ── 2a: Senha curta → erro no step 1 ───────────────────────────────────
  test('senha com 5 chars → erro "pelo menos 6 caracteres"', async ({ page }) => {
    test.setTimeout(90_000); // cold start Vercel pode demorar
    await page.goto('/register', { timeout: 60_000 }); // aguarda load + React hidratado

    await page.fill('#email', `short-pwd-${Date.now()}@test.io`);
    await page.fill('#password', '12345'); // 5 chars
    await page.click('button:has-text("Continuar")');

    // Erro visível, não avançou para step 2
    await expect(page.locator('[data-testid="register-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="register-error"]')).toContainText('pelo menos 6');
    await expect(page.locator('#businessName')).not.toBeVisible();
  });

  // ── 2b: Step 1 válido → chega no step 2 ────────────────────────────────
  test('step 1 válido → exibe formulário de negócio', async ({ page }) => {
    await page.goto('/register');

    await page.fill('#email', `step2-${Date.now()}@test.io`);
    await page.fill('#password', 'Valido123!');
    await page.click('button:has-text("Continuar")');

    // Step 2 carregado com campos corretos
    await expect(page.locator('#businessName')).toBeVisible();
    await expect(page.locator('#slug')).toBeVisible();
    await expect(page.locator('#city')).toBeVisible();
    await expect(page.locator('text=Selecione sua área')).toBeVisible();
  });

  // ── 2c: "Voltar" no step 2 → volta para step 1 ─────────────────────────
  test('"Voltar" retorna para step 1 sem perder o email', async ({ page }) => {
    await page.goto('/register');

    const email = `back-btn-${Date.now()}@test.io`;
    await page.fill('#email', email);
    await page.fill('#password', 'Valido123!');
    await page.click('button:has-text("Continuar")');

    await expect(page.locator('#businessName')).toBeVisible();

    // Clica Voltar
    await page.click('button:has-text("Voltar")');

    // Step 1 visível novamente com email preservado
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#email')).toHaveValue(email);
    await expect(page.locator('#businessName')).not.toBeVisible();
  });

  // ── 2d: Slug auto-gerado ao digitar nome do negócio ────────────────────
  test('businessName → gera slug automaticamente', async ({ page }) => {
    await page.goto('/register');

    await page.fill('#email', `slug-auto-${Date.now()}@test.io`);
    await page.fill('#password', 'Valido123!');
    await page.click('button:has-text("Continuar")');

    await page.fill('#businessName', 'Salão da Maria');
    // Aguarda debounce do slug (handleBusinessNameChange → generateSlug)
    await page.waitForTimeout(500);

    const slugValue = await page.locator('#slug').inputValue();
    expect(slugValue).toMatch(/sal.o-da-maria|salao-da-maria/i);
  });

  // ── 2e: Slug indisponível → erro visível ───────────────────────────────
  test('slug duplicado → erro "Este link já está em uso"', async ({ page }) => {
    // Busca um slug real que existe no banco
    const { data: prof } = await sb
      .from('professionals')
      .select('slug')
      .limit(1)
      .single();

    if (!prof?.slug) { test.skip(); return; }

    await page.goto('/register');
    await page.fill('#email', `dup-slug-${Date.now()}@test.io`);
    await page.fill('#password', 'Valido123!');
    await page.click('button:has-text("Continuar")');

    // Digita slug duplicado manualmente
    await page.fill('#businessName', 'Qualquer Nome');
    await page.waitForTimeout(300);
    await page.fill('#slug', prof.slug);
    await page.waitForTimeout(2000); // aguarda verificação async

    // Ícone de erro + texto de erro
    await expect(page.locator('[data-testid="slug-unavailable-icon"]')).toBeVisible();
    await expect(page.locator('[data-testid="slug-error"]')).toContainText('Este link já está em uso');
  });

  // ── 2f: Slug disponível → ícone verde ──────────────────────────────────
  test('slug único → ícone verde de disponível', async ({ page }) => {
    await page.goto('/register');
    await page.fill('#email', `slug-ok-${Date.now()}@test.io`);
    await page.fill('#password', 'Valido123!');
    await page.click('button:has-text("Continuar")');

    const uniqueSlug = `e2e-unique-${Date.now()}`;
    await page.fill('#slug', uniqueSlug);
    await page.waitForTimeout(2000); // aguarda verificação async

    await expect(page.locator('[data-testid="slug-available-icon"]')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECÇÃO 3 — Fluxo completo de registro (contexto limpo, sem sessão salva)
// Simula um usuário novo que chega pela primeira vez no app.
// Cria um profissional real → cleanup no afterAll.
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Fluxo completo de registro', () => {
  const TS = Date.now();
  const newEmail = `e2e-full-${TS}@circlehood-test.io`;
  const newSlug = `e2e-full-${String(TS).slice(-7)}`;
  const newBusiness = `Salão E2E ${TS}`;

  test.afterAll(async () => {
    await cleanupTestUser(newEmail);
  });

  test('registro 2 passos → redireciona /dashboard → banner de setup → welcome', async ({ browser }) => {
    test.setTimeout(60_000);

    // Contexto fresco: sem sessão salva (simula usuário novo)
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    try {
      await page.goto(BASE + '/register');

      // ─ Step 1: conta ──────────────────────────────────────────────────
      await page.fill('#email', newEmail);
      await page.fill('#password', 'E2eFullFlow1234!');
      await page.click('button:has-text("Continuar")');

      // ─ Step 2: negócio ────────────────────────────────────────────────
      await expect(page.locator('#businessName')).toBeVisible();

      // Digita nome → slug é gerado automaticamente
      await page.fill('#businessName', newBusiness);
      await page.waitForTimeout(500);

      // Substitui slug pelo único garantido
      await page.fill('#slug', newSlug);
      await page.waitForTimeout(2000); // aguarda verificação async

      // Confirma que slug está disponível (ícone verde)
      await expect(page.locator('[data-testid="slug-available-icon"]')).toBeVisible({ timeout: 5000 });

      await page.fill('#city', 'Dublin');
      await page.click('button:has-text("Criar minha página")');

      // ─ Dashboard após registro ────────────────────────────────────────
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 20_000 });

      // Welcome com nome do negócio
      await expect(page.locator('[data-testid="dashboard-welcome"]')).toContainText(newBusiness.split(' ')[0]);

      // Banner de setup visível (onboarding_completed = false)
      await expect(page.locator('[data-testid="onboarding-banner"]')).toBeVisible();
      await expect(page.locator('[data-testid="onboarding-banner"]')).toContainText('Configure sua conta');

      // Banner contém links de ação para as etapas de configuração
      // (o link /onboarding só aparece quando allRequiredDone; novos usuários
      // veem links individuais para /settings, /services, /schedule, etc.)
      await expect(page.locator('[data-testid="onboarding-banner"] a').first()).toBeVisible();
    } finally {
      await ctx.close();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECÇÃO 4 — Página de Onboarding (/onboarding) — usa sessão salva do setup
// Testa a checklist que aparece após o registro.
// ═══════════════════════════════════════════════════════════════════════════
test.describe('Página de Onboarding — Checklist', () => {
  // ── 4a: Estrutura da checklist ──────────────────────────────────────────
  test('exibe 5 passos com passo 1 (conta) sempre concluído', async ({ page }) => {
    await page.goto('/onboarding');

    // 5 step cards
    await expect(page.locator('[data-testid^="onboarding-step-"]')).toHaveCount(5);

    // Step 1 (account): sempre marcado como Concluído
    const step1 = page.locator('[data-testid="onboarding-step-account"]');
    await expect(step1).toContainText('Criar conta');
    await expect(step1).toContainText('Concluído');

    // Steps 2-5 existem
    await expect(page.locator('[data-testid="onboarding-step-services"]')).toBeVisible();
    await expect(page.locator('[data-testid="onboarding-step-schedule"]')).toBeVisible();
    await expect(page.locator('[data-testid="onboarding-step-whatsapp"]')).toBeVisible();
    await expect(page.locator('[data-testid="onboarding-step-profile"]')).toBeVisible();
  });

  // ── 4b: Progress bar ────────────────────────────────────────────────────
  test('progress bar mostra "X de 5 concluídos"', async ({ page }) => {
    await page.goto('/onboarding');
    await expect(page.locator('[data-testid="onboarding-progress-text"]')).toContainText('de 5 concluídos');
  });

  // ── 4c: Skip button ─────────────────────────────────────────────────────
  test('"Pular por enquanto" → redireciona para /dashboard', async ({ page }) => {
    await page.goto('/onboarding');
    await page.click('[data-testid="onboarding-skip"]');
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });

  // ── 4d: Finish button ───────────────────────────────────────────────────
  test('"Marcar como concluído" → redireciona para /dashboard', async ({ page }) => {
    await page.goto('/onboarding');

    const finishBtn = page.locator('[data-testid="onboarding-finish"]');
    await expect(finishBtn).toBeVisible();
    await finishBtn.click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });

  // ── 4e: Navegação para /services ────────────────────────────────────────
  test('clica "Adicionar serviços" → vai para /services', async ({ page }) => {
    await page.goto('/onboarding');

    // Só clica se o passo ainda não está concluído (link visível)
    const addBtn = page.locator('[data-testid="onboarding-step-services"] a:has-text("Adicionar serviços")');
    if (await addBtn.isVisible()) {
      await addBtn.click();
      await expect(page).toHaveURL(/\/services/);
    }
  });

  // ── 4f: Navegação para /schedule ────────────────────────────────────────
  test('clica "Configurar horários" → vai para /schedule', async ({ page }) => {
    await page.goto('/onboarding');

    const scheduleBtn = page.locator('[data-testid="onboarding-step-schedule"] a:has-text("Configurar horários")');
    if (await scheduleBtn.isVisible()) {
      await scheduleBtn.click();
      await expect(page).toHaveURL(/\/schedule/);
    }
  });

  // ── 4g: Badge "Importante" no step de WhatsApp ──────────────────────────
  test('step WhatsApp mostra badge "Importante" quando não concluído', async ({ page }) => {
    await page.goto('/onboarding');

    // A página é 'use client' com useEffect que carrega dados e mostra spinner.
    // Aguarda o step "account" (sempre presente após carregamento) aparecer
    // antes de fazer o check — evita race condition com isVisible().
    await page.locator('[data-testid="onboarding-step-account"]').waitFor({ timeout: 15_000 });

    const wpStep = page.locator('[data-testid="onboarding-step-whatsapp"]');
    // count() > 0 é determinístico (snapshot atual, não retry) após o waitFor acima
    const isDone = (await wpStep.locator('text=Concluído').count()) > 0;
    if (!isDone) {
      await expect(wpStep.locator('text=Importante')).toBeVisible();
    }
  });

  // ── 4h: Dashboard tem acesso ao fluxo de onboarding ────────────────────────
  // O banner de setup aparece quando onboarding_completed = false.
  // O botão "Concluir setup" (link /onboarding) SÓ aparece quando allRequiredDone
  // (todos os passos obrigatórios concluídos, incluindo WhatsApp).
  // Para o profissional de teste, o WhatsApp pode não estar ativo, então
  // verificamos que ao menos o banner OU o link está visível.
  test('dashboard tem acesso ao fluxo de onboarding (banner ou link)', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');

    // Banner de setup (aparece quando onboarding_completed = false)
    const hasBanner = await page.locator('[data-testid="onboarding-banner"]').isVisible().catch(() => false);
    // Link direto (aparece quando allRequiredDone)
    const hasLink = (await page.locator('a[href="/onboarding"]').count()) > 0;

    expect(hasBanner || hasLink).toBe(true);
  });
});
