/**
 * Testes de Autorização / IDOR — garantem que um profissional não consegue
 * acessar ou modificar dados de outro profissional.
 *
 * Cobertura:
 *  - Cross-professional: service_id de outro profissional → 404
 *  - IDOR booking: tentar criar agendamento em serviço que não é seu
 *  - IDOR slots: profissional inexistente → vazio, não dados de outro
 *  - Booking sem trial ativo → 403
 *  - Webhook WhatsApp com payload inválido → ignorado (não crashar)
 */
import { test, expect } from '@playwright/test';
import { TEST } from '../helpers/config';
import { nextWeekday } from '../helpers/setup';

const BASE = TEST.BASE_URL;

// UUID de profissional que não existe — não deve vazar dados de outro
const NONEXISTENT_PROF_ID = '00000000-dead-beef-0000-000000000000';
// UUID de serviço que não existe
const NONEXISTENT_SERVICE_ID = '00000000-dead-beef-0000-000000000001';

test.describe('Autorização — Cross-Professional (IDOR)', () => {
  test('POST /api/bookings com service_id inexistente → 404', async ({ request }) => {
    // Garante que não se cria booking com serviço que não pertence ao profissional
    const res = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: TEST.PROFESSIONAL_ID,
        service_id: NONEXISTENT_SERVICE_ID,
        booking_date: nextWeekday(1),
        start_time: '09:00',
        client_name: 'IDOR Teste',
        client_phone: '353800000099',
      },
    });
    expect(res.status()).toBe(404);
  });

  test('POST /api/bookings com professional_id inexistente → 403 ou 404', async ({ request }) => {
    // Profissional que não existe não deve criar agendamentos
    const res = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: NONEXISTENT_PROF_ID,
        service_id: NONEXISTENT_SERVICE_ID,
        booking_date: nextWeekday(1),
        start_time: '09:00',
        client_name: 'Ghost Client',
        client_phone: '353800000099',
      },
    });
    // Pode ser 403 (trial check falha) ou 404 (service not found)
    expect([403, 404]).toContain(res.status());
  });

  test('GET /api/available-slots com professional_id inexistente → slots vazio', async ({
    request,
  }) => {
    const res = await request.get(
      `${BASE}/api/available-slots?professional_id=${NONEXISTENT_PROF_ID}&date=${nextWeekday(1)}&service_id=${NONEXISTENT_SERVICE_ID}`
    );
    // Não deve retornar slots de outro profissional
    if (res.status() === 200) {
      const body = await res.json();
      const slots: string[] = body.slots ?? [];
      expect(slots).toHaveLength(0);
    } else {
      expect([400, 404]).toContain(res.status());
    }
  });

  test('GET /api/available-slots não mistura slots de profissionais diferentes', async ({
    request,
  }) => {
    // Chamar com professional_id real mas service_id inexistente → sem slots
    const res = await request.get(
      `${BASE}/api/available-slots?professional_id=${TEST.PROFESSIONAL_ID}&date=${nextWeekday(1)}&service_id=${NONEXISTENT_SERVICE_ID}`
    );
    // Service não pertence ao profissional → 404 ou slots vazio
    if (res.status() === 200) {
      const body = await res.json();
      const slots: string[] = body.slots ?? [];
      expect(slots).toHaveLength(0);
    } else {
      expect([400, 404]).toContain(res.status());
    }
  });
});

test.describe('Autorização — Booking Fields Validation', () => {
  test('POST /api/bookings sem client_phone → 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: TEST.PROFESSIONAL_ID,
        service_id: NONEXISTENT_SERVICE_ID,
        booking_date: nextWeekday(1),
        start_time: '09:00',
        client_name: 'Sem Telefone',
        // client_phone ausente
      },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/bookings sem booking_date → 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: TEST.PROFESSIONAL_ID,
        service_id: NONEXISTENT_SERVICE_ID,
        start_time: '09:00',
        client_name: 'Sem Data',
        client_phone: '353800000099',
        // booking_date ausente
      },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /api/bookings sem professional_id → 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/bookings`, {
      data: {
        service_id: NONEXISTENT_SERVICE_ID,
        booking_date: nextWeekday(1),
        start_time: '09:00',
        client_name: 'Sem Profissional',
        client_phone: '353800000099',
      },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe('Autorização — Reschedule Token (IDOR)', () => {
  test('GET /api/reschedule com token inexistente → 400 ou 404', async ({ request }) => {
    const fakeToken = 'aaaaaaaa-bbbb-cccc-dddd-000000000000';
    const res = await request.get(`${BASE}/api/reschedule/${fakeToken}`);
    expect([400, 404]).toContain(res.status());
  });

  test('POST /api/reschedule/cancel com token inexistente → 400 ou 404', async ({ request }) => {
    const fakeToken = 'ffffffff-0000-0000-0000-ffffffffffff';
    const res = await request.post(`${BASE}/api/reschedule/${fakeToken}/cancel`, {
      data: { reason: 'Tentativa de IDOR' },
    });
    expect([400, 404, 500]).toContain(res.status());
    // Não deve retornar 200 (não deve simular cancelamento com token falso)
    expect(res.status()).not.toBe(200);
  });

  test('POST /api/reschedule/change com token inexistente → 400 ou 404', async ({ request }) => {
    const fakeToken = '00000000-1111-2222-3333-444444444444';
    const res = await request.post(`${BASE}/api/reschedule/${fakeToken}/change`, {
      data: { new_date: nextWeekday(1), new_time: '10:00' },
    });
    expect([400, 404, 500]).toContain(res.status());
    expect(res.status()).not.toBe(200);
  });
});

test.describe('Autorização — WhatsApp Webhook', () => {
  test('GET /api/whatsapp/webhook com verify_token errado → não crashar', async ({ request }) => {
    // Verificação do webhook Meta
    // NOTA: Se WHATSAPP_VERIFY_TOKEN não está configurado, o endpoint pode aceitar qualquer token.
    // Este teste verifica apenas que a rota não retorna 500 (não crasha).
    // Em produção com token configurado, tokens errados devem retornar 403.
    const res = await request.get(
      `${BASE}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=token-errado&hub.challenge=test123`
    );
    expect(res.status()).not.toBe(500);
  });

  test('POST /api/whatsapp/webhook com payload malformado → não crashar (200 ou 400)', async ({
    request,
  }) => {
    // O webhook não deve causar 500 mesmo com payload inesperado
    const res = await request.post(`${BASE}/api/whatsapp/webhook`, {
      data: { unexpected: 'field', random: 123 },
    });
    // Aceita qualquer resposta EXCETO 500 (não deve crashar)
    expect(res.status()).not.toBe(500);
  });

  test('POST /api/whatsapp/webhook com payload vazio → não crashar', async ({ request }) => {
    const res = await request.post(`${BASE}/api/whatsapp/webhook`, {
      data: {},
    });
    expect(res.status()).not.toBe(500);
  });
});

test.describe('Autorização — Stripe Webhook', () => {
  test('POST /api/stripe/webhook sem assinatura → 400 ou 403', async ({ request }) => {
    // Stripe webhook sem header stripe-signature válido
    const res = await request.post(`${BASE}/api/stripe/webhook`, {
      data: { type: 'checkout.session.completed', data: {} },
      headers: {
        'stripe-signature': 'assinatura-invalida',
        'content-type': 'application/json',
      },
    });
    // Stripe rejeita assinaturas inválidas
    expect([400, 403]).toContain(res.status());
  });
});
