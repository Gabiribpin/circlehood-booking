/**
 * Testes de Validação de Input / Injeção — garantem que a API rejeita
 * ou sanitiza corretamente entradas maliciosas.
 *
 * Cobertura:
 *  - SQL injection em campos de booking
 *  - XSS payload em client_name / notes
 *  - Payloads excessivamente grandes
 *  - Datas malformadas
 *  - Horários fora do range
 *  - Content-Type errado
 *  - JSON malformado
 */
import { test, expect } from '@playwright/test';
import { TEST } from '../helpers/config';
import { nextWeekday } from '../helpers/setup';

const BASE = TEST.BASE_URL;
const NONEXISTENT_SERVICE_ID = '00000000-dead-beef-0000-000000000001';

// ─── Utilitário ─────────────────────────────────────────────────────────────

/** Envia booking com campos customizados e espera que não retorne 500. */
async function postBookingNoServerCrash(
  request: import('@playwright/test').APIRequestContext,
  overrides: Record<string, unknown>
) {
  const res = await request.post(`${BASE}/api/bookings`, {
    data: {
      professional_id: TEST.PROFESSIONAL_ID,
      service_id: NONEXISTENT_SERVICE_ID,
      booking_date: nextWeekday(1),
      start_time: '09:00',
      client_name: 'Teste Segurança',
      client_phone: '353800000099',
      ...overrides,
    },
  });
  // Qualquer resposta é aceitável EXCETO 500 (não deve crashar o servidor)
  expect(res.status()).not.toBe(500);
  return res;
}

// ─── SQL Injection ────────────────────────────────────────────────────────────

test.describe('Validação de Input — SQL Injection', () => {
  test("client_name com SQL injection → não crashar (400 ou 404)", async ({ request }) => {
    const res = await postBookingNoServerCrash(request, {
      client_name: "'; DROP TABLE bookings; --",
    });
    // Deve rejeitar ou ignorar, nunca 500
    expect([400, 404]).toContain(res.status());
  });

  test("notes com SQL injection → não crashar", async ({ request }) => {
    const res = await postBookingNoServerCrash(request, {
      client_name: 'Cliente Normal',
      notes: "'; DELETE FROM professionals WHERE '1'='1",
    });
    expect([400, 404]).toContain(res.status());
  });

  test("booking_date com SQL injection → 400 ou 404", async ({ request }) => {
    const res = await postBookingNoServerCrash(request, {
      booking_date: "2026-01-01'; DROP TABLE bookings; --",
    });
    expect([400, 404]).toContain(res.status());
  });

  test("start_time com SQL injection → 400 ou 404", async ({ request }) => {
    const res = await postBookingNoServerCrash(request, {
      start_time: "09:00'; SELECT * FROM professionals; --",
    });
    expect([400, 404]).toContain(res.status());
  });
});

// ─── XSS Payloads ─────────────────────────────────────────────────────────────

test.describe('Validação de Input — XSS', () => {
  test('client_name com script tag → não crashar', async ({ request }) => {
    const res = await postBookingNoServerCrash(request, {
      client_name: '<script>alert("xss")</script>',
    });
    expect([400, 404]).toContain(res.status());
  });

  test('client_name com img onerror → não crashar', async ({ request }) => {
    const res = await postBookingNoServerCrash(request, {
      client_name: '<img src=x onerror=alert(1)>',
    });
    expect([400, 404]).toContain(res.status());
  });

  test('notes com JavaScript URL → não crashar', async ({ request }) => {
    const res = await postBookingNoServerCrash(request, {
      client_name: 'Teste',
      notes: 'javascript:alert(document.cookie)',
    });
    expect([400, 404]).toContain(res.status());
  });

  test('client_email com XSS → não crashar', async ({ request }) => {
    const res = await postBookingNoServerCrash(request, {
      client_name: 'Teste',
      client_email: '"><script>alert(1)</script>@hack.com',
    });
    expect([400, 404]).toContain(res.status());
  });
});

// ─── Payloads Grandes ─────────────────────────────────────────────────────────

test.describe('Validação de Input — Payloads Excessivos', () => {
  test('client_name com 10.000 caracteres → não crashar', async ({ request }) => {
    const res = await postBookingNoServerCrash(request, {
      client_name: 'A'.repeat(10_000),
    });
    // Pode rejeitar com 400 (campo muito longo) ou 404 (service not found antes de chegar no insert)
    expect([400, 404]).toContain(res.status());
  });

  test('notes com 100.000 caracteres → não crashar', async ({ request }) => {
    const res = await postBookingNoServerCrash(request, {
      client_name: 'Teste',
      notes: 'N'.repeat(100_000),
    });
    expect([400, 404]).toContain(res.status());
  });

  test('payload JSON com 1000 campos extras → não crashar', async ({ request }) => {
    const extraFields: Record<string, string> = {};
    for (let i = 0; i < 1000; i++) extraFields[`extra_${i}`] = `value_${i}`;

    const res = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: TEST.PROFESSIONAL_ID,
        service_id: NONEXISTENT_SERVICE_ID,
        booking_date: nextWeekday(1),
        start_time: '09:00',
        client_name: 'Flood Teste',
        client_phone: '353800000099',
        ...extraFields,
      },
    });
    expect(res.status()).not.toBe(500);
  });
});

// ─── Datas e Horários Inválidos ───────────────────────────────────────────────

test.describe('Validação de Input — Datas e Horários', () => {
  test('booking_date no passado → pode criar (sem validação de data passada na API)', async ({
    request,
  }) => {
    // A API não necessariamente rejeita datas passadas (é regra de negócio, não de segurança)
    // O teste verifica apenas que não retorna 500
    const res = await postBookingNoServerCrash(request, {
      booking_date: '2000-01-01',
    });
    expect(res.status()).not.toBe(500);
  });

  test('booking_date com formato inválido → 400 ou 404', async ({ request }) => {
    const res = await postBookingNoServerCrash(request, {
      booking_date: 'nao-e-uma-data',
    });
    expect([400, 404]).toContain(res.status());
  });

  test('start_time com formato inválido → 400 ou 404', async ({ request }) => {
    const res = await postBookingNoServerCrash(request, {
      start_time: 'nao-e-horario',
    });
    expect([400, 404]).toContain(res.status());
  });

  test('booking_date com ano inexistente → não crashar', async ({ request }) => {
    const res = await postBookingNoServerCrash(request, {
      booking_date: '9999-99-99',
    });
    expect(res.status()).not.toBe(500);
  });
});

// ─── Content-Type e Formato ───────────────────────────────────────────────────

test.describe('Validação de Input — Content-Type e Formato', () => {
  test('POST /api/bookings sem body → 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/bookings`, {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test('GET /api/available-slots sem parâmetros → 400', async ({ request }) => {
    const res = await request.get(`${BASE}/api/available-slots`);
    expect(res.status()).toBe(400);
  });

  test('POST /api/register com body vazio → 400 ou 422', async ({ request }) => {
    const res = await request.post(`${BASE}/api/register`, {
      data: {},
    });
    expect([400, 422]).toContain(res.status());
  });
});

// ─── Path Traversal / Injection em Parâmetros de URL ─────────────────────────

test.describe('Validação de Input — Path Traversal', () => {
  test('reschedule com token com path traversal → 400 ou 404', async ({ request }) => {
    const res = await request.get(`${BASE}/api/reschedule/../../etc/passwd`);
    // Next.js deve normalizar o path — não deve retornar 500 nem expor arquivos
    expect(res.status()).not.toBe(500);
    expect(res.status()).not.toBe(200); // não deve ter sucesso
  });

  test('reschedule com token com caracteres especiais → não crashar', async ({ request }) => {
    const res = await request.get(`${BASE}/api/reschedule/<script>alert(1)</script>`);
    expect(res.status()).not.toBe(500);
  });

  test('available-slots com professionalId com SQL → não crashar', async ({ request }) => {
    const res = await request.get(
      `${BASE}/api/available-slots?professional_id='; DROP TABLE professionals; --&date=2026-03-01&service_id=fake`
    );
    expect(res.status()).not.toBe(500);
  });
});
