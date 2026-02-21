/**
 * Testes de Autenticação — garantem que endpoints protegidos
 * retornam 401/403 quando chamados sem credenciais válidas.
 *
 * Cobertura:
 *  - APIs do dashboard (analytics, contacts, gallery, page-sections)
 *  - Cron jobs sem CRON_SECRET
 *  - Admin endpoints sem secret
 *  - WhatsApp send sem auth
 *  - Stripe checkout sem auth
 */
import { test, expect } from '@playwright/test';
import { TEST } from '../helpers/config';

const BASE = TEST.BASE_URL;

// ─── Utilitário ─────────────────────────────────────────────────────────────

/** Faz requisição sem cookies de auth e verifica resposta de não-autorizado. */
async function expectUnauthorized(
  res: { status(): number },
  allowed: number[] = [401, 403]
) {
  expect(allowed).toContain(res.status());
}

// ─── APIs do Dashboard (protegidas por getUser()) ────────────────────────────

test.describe('Autenticação — APIs do Dashboard', () => {
  test('GET /api/analytics/overview sem auth → 401/403', async ({ request }) => {
    const res = await request.get(`${BASE}/api/analytics/overview`);
    await expectUnauthorized(res);
  });

  test('GET /api/analytics/revenue sem auth → 401/403', async ({ request }) => {
    const res = await request.get(`${BASE}/api/analytics/revenue`);
    await expectUnauthorized(res);
  });

  test('GET /api/analytics/clients sem auth → 401/403', async ({ request }) => {
    const res = await request.get(`${BASE}/api/analytics/clients`);
    await expectUnauthorized(res);
  });

  test('POST /api/contacts/import sem auth → 401/403', async ({ request }) => {
    const res = await request.post(`${BASE}/api/contacts/import`, {
      data: { contacts: [{ name: 'Teste', phone: '5511999999999' }] },
    });
    await expectUnauthorized(res);
  });

  test('PUT /api/gallery sem auth → 401/403', async ({ request }) => {
    const res = await request.put(`${BASE}/api/gallery`, {
      data: { id: 'fake-id', title: 'hack' },
    });
    await expectUnauthorized(res);
  });

  test('DELETE /api/gallery sem auth → 401/403', async ({ request }) => {
    const res = await request.delete(`${BASE}/api/gallery?id=fake-id`);
    await expectUnauthorized(res);
  });

  test('POST /api/gallery/upload sem auth → 401/403', async ({ request }) => {
    const res = await request.post(`${BASE}/api/gallery/upload`, {
      data: { url: 'https://example.com/img.jpg' },
    });
    await expectUnauthorized(res);
  });

  test('POST /api/testimonials sem auth → 401/403', async ({ request }) => {
    const res = await request.post(`${BASE}/api/testimonials`, {
      data: { text: 'Ótimo serviço', client_name: 'Hacker', rating: 5 },
    });
    await expectUnauthorized(res);
  });

  test('DELETE /api/testimonials sem auth → 401/403', async ({ request }) => {
    const res = await request.delete(`${BASE}/api/testimonials?id=fake-id`);
    await expectUnauthorized(res);
  });

  test('GET /api/page-sections sem auth → 401/403', async ({ request }) => {
    const res = await request.get(`${BASE}/api/page-sections`);
    await expectUnauthorized(res);
  });

  test('POST /api/page-sections sem auth → 401/403', async ({ request }) => {
    const res = await request.post(`${BASE}/api/page-sections`, {
      data: { type: 'hero', content: 'hacked' },
    });
    await expectUnauthorized(res);
  });

  test('GET /api/email-campaigns sem auth → 401/403', async ({ request }) => {
    const res = await request.get(`${BASE}/api/email-campaigns`);
    await expectUnauthorized(res);
  });

  test('POST /api/email-campaigns sem auth → 401/403', async ({ request }) => {
    const res = await request.post(`${BASE}/api/email-campaigns`, {
      data: { name: 'hack', subject: 'x', html_content: '<b>x</b>' },
    });
    await expectUnauthorized(res);
  });

  test('POST /api/whatsapp/send sem auth → 401/403', async ({ request }) => {
    const res = await request.post(`${BASE}/api/whatsapp/send`, {
      data: { to: '5511999999999', message: 'hack' },
    });
    await expectUnauthorized(res);
  });

  test('POST /api/stripe/checkout sem auth → 401/403', async ({ request }) => {
    const res = await request.post(`${BASE}/api/stripe/checkout`, {
      data: { plan: 'pro' },
    });
    await expectUnauthorized(res);
  });

  test('POST /api/generate-bio sem auth → 401/403', async ({ request }) => {
    const res = await request.post(`${BASE}/api/generate-bio`, {
      data: { category: 'hair' },
    });
    await expectUnauthorized(res);
  });
});

// ─── Cron Jobs (protegidos por CRON_SECRET) ──────────────────────────────────

test.describe('Autenticação — Cron Jobs', () => {
  test('POST /api/cron/send-reminders sem secret → 401/403', async ({ request }) => {
    const res = await request.post(`${BASE}/api/cron/send-reminders`, {
      data: {},
      // Sem Authorization header
    });
    await expectUnauthorized(res);
  });

  test('POST /api/cron/send-reminders com secret errado → 401/403', async ({ request }) => {
    const res = await request.post(`${BASE}/api/cron/send-reminders`, {
      data: {},
      headers: { Authorization: 'Bearer token-completamente-errado-xyzabc' },
    });
    await expectUnauthorized(res);
  });

  test('POST /api/cron/refresh-analytics sem secret → 401/403', async ({ request }) => {
    const res = await request.post(`${BASE}/api/cron/refresh-analytics`, {
      data: {},
    });
    await expectUnauthorized(res);
  });

  test('POST /api/cron/send-campaign-messages sem secret → 401/403', async ({ request }) => {
    const res = await request.post(`${BASE}/api/cron/send-campaign-messages`, {
      data: {},
    });
    await expectUnauthorized(res);
  });

  test('POST /api/notifications/send sem secret → 401/403', async ({ request }) => {
    const res = await request.post(`${BASE}/api/notifications/send`, {
      data: { recipient_phone: '5511999999', message: 'hack' },
    });
    await expectUnauthorized(res);
  });
});

// ─── Admin Endpoints (protegidos por SETUP_SECRET) ───────────────────────────

test.describe('Autenticação — Admin Endpoints', () => {
  test('POST /api/admin/setup-storage sem secret → 401/403', async ({ request }) => {
    const res = await request.post(`${BASE}/api/admin/setup-storage`, {
      data: { secret: 'senha-errada' },
    });
    await expectUnauthorized(res);
  });

  test('POST /api/admin/fix-triggers sem secret → 401/403', async ({ request }) => {
    const res = await request.post(`${BASE}/api/admin/fix-triggers`, {
      data: { secret: '' },
    });
    await expectUnauthorized(res);
  });

  test('POST /api/admin/clear-bot-cache sem secret → 401/403', async ({ request }) => {
    const res = await request.post(`${BASE}/api/admin/clear-bot-cache`, {
      data: { business_id: 'fake', phone: '5511999999' },
      headers: { 'x-admin-secret': 'senha-errada' },
    });
    await expectUnauthorized(res);
  });
});

// ─── Integrations (protegidas por getUser()) ─────────────────────────────────

test.describe('Autenticação — Integrações', () => {
  test('GET /api/integrations sem auth → 401/403', async ({ request }) => {
    const res = await request.get(`${BASE}/api/integrations`);
    await expectUnauthorized(res);
  });

  test('POST /api/integrations/google-calendar/sync sem auth → 401/403', async ({ request }) => {
    const res = await request.post(`${BASE}/api/integrations/google-calendar/sync`, {
      data: {},
    });
    await expectUnauthorized(res);
  });

  test('POST /api/integrations/google-calendar/disconnect sem auth → 401/403', async ({
    request,
  }) => {
    const res = await request.post(`${BASE}/api/integrations/google-calendar/disconnect`, {
      data: {},
    });
    await expectUnauthorized(res);
  });
});
