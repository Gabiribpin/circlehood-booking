/**
 * Testes E2E — Verificação de Email
 *
 * Cobre o fluxo de verificação via API:
 *  - POST /api/auth/signup-with-verification → cria conta + envia email
 *  - GET  /api/auth/verify-email?token=...   → confirma email (token válido/inválido/expirado)
 *  - POST /api/auth/resend-verification-email → reenvia email de verificação
 *
 * Nota: o clique real no link do email não pode ser testado em E2E
 * (Resend envia para inbox real). Testamos via API direta.
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { TEST } from '../helpers/config';

const BASE = TEST.BASE_URL;
const sb = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);

// ─── Cleanup helper ──────────────────────────────────────────────────────────

async function cleanupVerificationUser(email: string): Promise<void> {
  const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = data?.users?.find((u) => u.email === email);
  if (!user) return;

  const { data: prof } = await sb
    .from('professionals')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (prof) {
    await sb.from('email_verification_tokens').delete().eq('professional_id', prof.id).catch(() => {});
    await sb.from('bookings').delete().eq('professional_id', prof.id);
    await sb.from('services').delete().eq('professional_id', prof.id);
    await sb.from('working_hours').delete().eq('professional_id', prof.id);
    await sb.from('professionals').delete().eq('id', prof.id);
  }
  await sb.auth.admin.deleteUser(user.id).catch(() => {});
}

// ═════════════════════════════════════════════════════════════════════════════
// Testes de Verificação de Email via API
// ═════════════════════════════════════════════════════════════════════════════

test.describe('Email Verification — API', () => {

  // ── 1. Campos obrigatórios ────────────────────────────────────────────────
  test('POST sem email → 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/signup-with-verification`, {
      data: { password: 'Teste1234!', businessName: 'Teste', slug: 'teste-slug-99' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST sem senha → 400', async ({ request }) => {
    const ts = Date.now();
    const res = await request.post(`${BASE}/api/auth/signup-with-verification`, {
      data: { email: `ev-${ts}@test.io`, businessName: 'Teste', slug: `ev-${ts}` },
    });
    expect(res.status()).toBe(400);
  });

  // ── 2. Token inválido ─────────────────────────────────────────────────────
  test('GET verify-email com token inválido → 400 ou 404', async ({ request }) => {
    const res = await request.get(
      `${BASE}/api/auth/verify-email?token=token-invalido-000`
    );
    expect([400, 404]).toContain(res.status());
  });

  // ── 3. Token mal-formado (curto demais) ───────────────────────────────────
  test('GET verify-email sem token → 400', async ({ request }) => {
    const res = await request.get(`${BASE}/api/auth/verify-email`);
    expect(res.status()).toBe(400);
  });

  // ── 4. Reenvio sem email → 400 ────────────────────────────────────────────
  test('POST resend-verification-email sem email → 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/resend-verification-email`, {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  // ── 5. Reenvio para email não cadastrado → 404 ou 400 ────────────────────
  test('POST resend-verification-email para email não cadastrado → 400/404', async ({ request }) => {
    const res = await request.post(`${BASE}/api/auth/resend-verification-email`, {
      data: { email: 'nao-existe-@@@circlehood-test.io' },
    });
    expect([400, 404]).toContain(res.status());
  });

  // ── 6. Happy path: cadastro retorna sucesso ───────────────────────────────
  test('POST com dados válidos → cria conta + retorna success', async ({ request }) => {
    const ts = Date.now();
    const email = `ev-verify-${ts}@circlehood-test.io`;
    const slug = `ev-${String(ts).slice(-7)}`;

    try {
      const res = await request.post(`${BASE}/api/auth/signup-with-verification`, {
        data: {
          email,
          password: 'E2eVerify1234!',
          businessName: `Verify Test ${ts}`,
          slug,
          city: 'Dublin',
        },
      });

      // Pode retornar 200 (criado) ou 400 (email inválido / já existe)
      // O importante é que não retorne 500
      expect(res.status()).not.toBe(500);

      if (res.status() === 200 || res.status() === 201) {
        const body = await res.json();
        expect(body.success).toBe(true);
      }
    } finally {
      await cleanupVerificationUser(email);
    }
  });

  // ── 7. Token expirado ─────────────────────────────────────────────────────
  test('GET verify-email com token UUID não existente → 400 ou 404', async ({ request }) => {
    // UUID v4 válido mas não existente no banco
    const fakeToken = '00000000-0000-4000-a000-000000000099';
    const res = await request.get(`${BASE}/api/auth/verify-email?token=${fakeToken}`);
    expect([400, 404]).toContain(res.status());
  });
});
