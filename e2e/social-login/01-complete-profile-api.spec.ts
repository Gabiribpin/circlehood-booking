/**
 * Testes E2E — API /api/auth/complete-profile
 *
 * Cobre:
 *  - 401: sem autenticação
 *  - 400: dados inválidos (Zod)
 *  - 400: slug já em uso
 *  - 409: profissional já existe
 *  - 201: happy path (cria profissional via OAuth flow)
 *
 * Nota: Testes autenticados usam browser login + page.evaluate(fetch())
 * porque o Supabase server client lê cookies da sessão do browser.
 * Testes criam usuários auth reais via service role e limpam após cada teste.
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { TEST } from '../helpers/config';

const BASE = TEST.BASE_URL;
const sb = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);

// ─── Cleanup helper ──────────────────────────────────────────────────────────

async function cleanupTestUser(userId: string): Promise<void> {
  const { data: prof } = await sb
    .from('professionals')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (prof) {
    await sb.from('bookings').delete().eq('professional_id', prof.id);
    await sb.from('working_hours').delete().eq('professional_id', prof.id);
    await sb.from('services').delete().eq('professional_id', prof.id);
    await sb.from('professionals').delete().eq('id', prof.id);
  }
  await sb.auth.admin.deleteUser(userId).catch(() => {});
}

// Cria um auth user com senha temporária (simula estado pós-OAuth: user sem professional)
async function createTestOAuthUser(email: string): Promise<{ userId: string; password: string }> {
  const password = `TempOAuth${Date.now()}!`;
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`Falha ao criar user: ${error?.message}`);
  return { userId: data.user.id, password };
}

// Login via browser e retorna page autenticada
async function loginInBrowser(
  page: import('@playwright/test').Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto(`${BASE}/login`);
  await expect(page.locator('#email')).toBeVisible({ timeout: 15_000 });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  // OAuth user sem professional → vai para /complete-profile ou /dashboard
  // Esperar qualquer redirect resolver
  await page.waitForLoadState('networkidle', { timeout: 20_000 });
}

// Faz POST via fetch() dentro do browser (usa cookies reais da sessão)
async function postFromBrowser(
  page: import('@playwright/test').Page,
  url: string,
  body: Record<string, unknown>
): Promise<{ status: number; body: Record<string, unknown> }> {
  return page.evaluate(async ({ url, body }) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { status: res.status, body: json };
  }, { url, body });
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTES
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Complete Profile API — /api/auth/complete-profile', () => {
  // ── 1. Sem autenticação → 401 ─────────────────────────────────────────────
  test('POST sem auth → 401', async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/complete-profile`, {
      data: {
        business_name: 'Teste',
        slug: 'teste-no-auth',
        city: 'Dublin',
        country: 'IE',
      },
    });
    expect(res.status()).toBe(401);
  });

  // ── 2. Dados inválidos → 400 ─────────────────────────────────────────────
  test('POST com slug inválido (< 3 chars) → 400', async ({ page }) => {
    const ts = Date.now();
    const email = `e2e-cp-bad-${ts}@circlehood-test.io`;
    let userId = '';

    try {
      const { userId: uid, password } = await createTestOAuthUser(email);
      userId = uid;
      await loginInBrowser(page, email, password);

      const result = await postFromBrowser(page, `${BASE}/api/auth/complete-profile`, {
        business_name: 'Teste',
        slug: 'ab', // < 3 chars
        city: 'Dublin',
        country: 'IE',
      });
      expect(result.status).toBe(400);
    } finally {
      if (userId) await cleanupTestUser(userId);
    }
  });

  test('POST sem business_name → 400', async ({ page }) => {
    const ts = Date.now();
    const email = `e2e-cp-noname-${ts}@circlehood-test.io`;
    let userId = '';

    try {
      const { userId: uid, password } = await createTestOAuthUser(email);
      userId = uid;
      await loginInBrowser(page, email, password);

      const result = await postFromBrowser(page, `${BASE}/api/auth/complete-profile`, {
        slug: 'teste-no-name',
        city: 'Dublin',
        country: 'IE',
      });
      expect(result.status).toBe(400);
    } finally {
      if (userId) await cleanupTestUser(userId);
    }
  });

  // ── 3. Slug já em uso → 400 ──────────────────────────────────────────────
  test('POST com slug do profissional existente → 400', async ({ page }) => {
    const ts = Date.now();
    const email = `e2e-cp-slug-${ts}@circlehood-test.io`;
    let userId = '';

    try {
      const { userId: uid, password } = await createTestOAuthUser(email);
      userId = uid;

      // Buscar slug do profissional de teste (Salão da Rita)
      const { data: existingProf } = await sb
        .from('professionals')
        .select('slug')
        .eq('id', TEST.PROFESSIONAL_ID)
        .single();

      expect(existingProf?.slug).toBeTruthy();

      await loginInBrowser(page, email, password);

      const result = await postFromBrowser(page, `${BASE}/api/auth/complete-profile`, {
        business_name: 'Slug Duplicado',
        slug: existingProf!.slug,
        city: 'Dublin',
        country: 'IE',
      });
      expect(result.status).toBe(400);
      expect(result.body.error).toMatch(/link|slug|uso/i);
    } finally {
      if (userId) await cleanupTestUser(userId);
    }
  });

  // ── 4. Happy path → 201 ──────────────────────────────────────────────────
  test('POST com dados válidos → 201 + cria professional', async ({ page }) => {
    const ts = Date.now();
    const email = `e2e-cp-ok-${ts}@circlehood-test.io`;
    const slug = `e2e-cp-${String(ts).slice(-8)}`;
    let userId = '';

    try {
      const { userId: uid, password } = await createTestOAuthUser(email);
      userId = uid;
      await loginInBrowser(page, email, password);

      const result = await postFromBrowser(page, `${BASE}/api/auth/complete-profile`, {
        business_name: `OAuth Test ${ts}`,
        slug,
        city: 'Dublin',
        country: 'IE',
        category: 'Personal Trainer',
        currency: 'eur',
        locale: 'pt-BR',
      });

      expect(result.status).toBe(201);
      expect(result.body.success).toBe(true);
      expect(result.body.redirect).toBeTruthy();

      // Verificar que professional foi criado no banco
      const { data: prof } = await sb
        .from('professionals')
        .select('slug, business_name, email_verified, subscription_status, city, country')
        .eq('user_id', userId)
        .single();

      expect(prof).toBeTruthy();
      expect(prof!.slug).toBe(slug);
      expect(prof!.email_verified).toBe(true); // OAuth = email confirmado
      expect(prof!.subscription_status).toBe('trial');
      expect(prof!.city).toBe('Dublin');
      expect(prof!.country).toBe('IE');
    } finally {
      if (userId) await cleanupTestUser(userId);
    }
  });

  // ── 5. Profissional já existe → 409 ──────────────────────────────────────
  test('POST quando professional já existe → 409', async ({ page }) => {
    const ts = Date.now();
    const email = `e2e-cp-dup-${ts}@circlehood-test.io`;
    const slug = `e2e-cp-dup-${String(ts).slice(-8)}`;
    let userId = '';

    try {
      const { userId: uid, password } = await createTestOAuthUser(email);
      userId = uid;

      // Criar professional manualmente (simular que já completou perfil)
      await sb.from('professionals').insert({
        user_id: userId,
        business_name: 'Já Existe',
        slug,
        city: 'Dublin',
        country: 'IE',
        email_verified: true,
      } as never);

      await loginInBrowser(page, email, password);

      const result = await postFromBrowser(page, `${BASE}/api/auth/complete-profile`, {
        business_name: 'Segundo Perfil',
        slug: `${slug}-2`,
        city: 'Lisboa',
        country: 'PT',
      });

      expect(result.status).toBe(409);
      expect(result.body.error).toMatch(/existe|already/i);
    } finally {
      if (userId) await cleanupTestUser(userId);
    }
  });
});
