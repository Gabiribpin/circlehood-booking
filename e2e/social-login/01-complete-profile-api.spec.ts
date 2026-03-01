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
 * Nota: Estes testes criam usuários auth reais via service role
 * e limpam após cada teste.
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

// Cria um auth user simulando OAuth (sem password, sem professional)
async function createOAuthUser(email: string): Promise<{ userId: string; accessToken: string }> {
  const { data, error } = await sb.auth.admin.createUser({
    email,
    email_confirm: true,
    // Não cria professional — simula estado pós-OAuth
  });
  if (error || !data.user) throw new Error(`Falha ao criar user: ${error?.message}`);

  // Gerar sessão para obter access_token
  const { data: session, error: sessionError } = await sb.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (sessionError) throw new Error(`Falha ao gerar link: ${sessionError.message}`);

  // Usar signInWithPassword com senha temporária
  const tempPassword = `TempOAuth${Date.now()}!`;
  await sb.auth.admin.updateUser(data.user.id, { password: tempPassword });

  const { data: signIn, error: signInError } = await sb.auth.signInWithPassword({
    email,
    password: tempPassword,
  });
  if (signInError || !signIn.session) throw new Error(`Falha no signIn: ${signInError?.message}`);

  return { userId: data.user.id, accessToken: signIn.session.access_token };
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
  test('POST com slug inválido (< 3 chars) → 400', async ({ request }) => {
    const ts = Date.now();
    const email = `e2e-cp-bad-${ts}@circlehood-test.io`;
    let userId = '';

    try {
      const { userId: uid, accessToken } = await createOAuthUser(email);
      userId = uid;

      const res = await request.post(`${BASE}/api/auth/complete-profile`, {
        headers: {
          'Content-Type': 'application/json',
          Cookie: `sb-access-token=${accessToken}`,
        },
        data: {
          business_name: 'Teste',
          slug: 'ab', // < 3 chars
          city: 'Dublin',
          country: 'IE',
        },
      });
      expect(res.status()).toBe(400);
    } finally {
      if (userId) await cleanupTestUser(userId);
    }
  });

  test('POST sem business_name → 400', async ({ request }) => {
    const ts = Date.now();
    const email = `e2e-cp-noname-${ts}@circlehood-test.io`;
    let userId = '';

    try {
      const { userId: uid, accessToken } = await createOAuthUser(email);
      userId = uid;

      const res = await request.post(`${BASE}/api/auth/complete-profile`, {
        headers: {
          'Content-Type': 'application/json',
          Cookie: `sb-access-token=${accessToken}`,
        },
        data: {
          slug: 'teste-no-name',
          city: 'Dublin',
          country: 'IE',
        },
      });
      expect(res.status()).toBe(400);
    } finally {
      if (userId) await cleanupTestUser(userId);
    }
  });

  // ── 3. Slug já em uso → 400 ──────────────────────────────────────────────
  test('POST com slug do profissional existente → 400', async ({ request }) => {
    const ts = Date.now();
    const email = `e2e-cp-slug-${ts}@circlehood-test.io`;
    let userId = '';

    try {
      const { userId: uid, accessToken } = await createOAuthUser(email);
      userId = uid;

      // Buscar slug do profissional de teste (Salão da Rita)
      const { data: existingProf } = await sb
        .from('professionals')
        .select('slug')
        .eq('id', TEST.PROFESSIONAL_ID)
        .single();

      expect(existingProf?.slug).toBeTruthy();

      const res = await request.post(`${BASE}/api/auth/complete-profile`, {
        headers: {
          'Content-Type': 'application/json',
          Cookie: `sb-access-token=${accessToken}`,
        },
        data: {
          business_name: 'Slug Duplicado',
          slug: existingProf!.slug,
          city: 'Dublin',
          country: 'IE',
        },
      });
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/link|slug|uso/i);
    } finally {
      if (userId) await cleanupTestUser(userId);
    }
  });

  // ── 4. Happy path → 201 ──────────────────────────────────────────────────
  test('POST com dados válidos → 201 + cria professional', async ({ request }) => {
    const ts = Date.now();
    const email = `e2e-cp-ok-${ts}@circlehood-test.io`;
    const slug = `e2e-cp-${String(ts).slice(-8)}`;
    let userId = '';

    try {
      const { userId: uid, accessToken } = await createOAuthUser(email);
      userId = uid;

      const res = await request.post(`${BASE}/api/auth/complete-profile`, {
        headers: {
          'Content-Type': 'application/json',
          Cookie: `sb-access-token=${accessToken}`,
        },
        data: {
          business_name: `OAuth Test ${ts}`,
          slug,
          city: 'Dublin',
          country: 'IE',
          category: 'Personal Trainer',
          currency: 'eur',
          locale: 'pt-BR',
        },
      });

      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.redirect).toBeTruthy();

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
  test('POST quando professional já existe → 409', async ({ request }) => {
    const ts = Date.now();
    const email = `e2e-cp-dup-${ts}@circlehood-test.io`;
    const slug = `e2e-cp-dup-${String(ts).slice(-8)}`;
    let userId = '';

    try {
      const { userId: uid, accessToken } = await createOAuthUser(email);
      userId = uid;

      // Criar professional manualmente (simular que já completou perfil)
      await sb.from('professionals').insert({
        user_id: userId,
        email,
        business_name: 'Já Existe',
        slug,
        city: 'Dublin',
        country: 'IE',
        email_verified: true,
        subscription_status: 'trial',
      } as never);

      // Tentar completar perfil novamente
      const res = await request.post(`${BASE}/api/auth/complete-profile`, {
        headers: {
          'Content-Type': 'application/json',
          Cookie: `sb-access-token=${accessToken}`,
        },
        data: {
          business_name: 'Segundo Perfil',
          slug: `${slug}-2`,
          city: 'Lisboa',
          country: 'PT',
        },
      });

      expect(res.status()).toBe(409);
      const body = await res.json();
      expect(body.error).toMatch(/existe|already/i);
    } finally {
      if (userId) await cleanupTestUser(userId);
    }
  });
});
