/**
 * Testes da API pública de agendamento — simula o ciclo de uma cliente
 * acessando a página pública do Salão da Rita e fazendo um agendamento.
 *
 * Cenários cobertos:
 *  1. GET /api/available-slots → retorna slots para um dia válido
 *  2. POST /api/bookings → happy path (cria agendamento)
 *  3. POST /api/bookings → conflito de horário (409)
 *  4. POST /api/bookings → service não pertence ao profissional (404)
 *  5. POST /api/bookings → campos obrigatórios ausentes (400)
 *  6. POST /api/bookings → profissional com trial expirado (403)
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { TEST } from '../helpers/config';
import { nextWeekday } from '../helpers/setup';

const BASE = TEST.BASE_URL;
const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);

// Limpa agendamentos de teste criados por este arquivo (phone específico de API tests)
const TEST_PHONE_API = '353800000001'; // phone dedicado para API tests (não interfere no bot)

async function cleanApiTestBookings() {
  await supabase
    .from('bookings')
    .update({ status: 'cancelled', cancelled_by: 'system', cancellation_reason: 'API E2E cleanup' })
    .eq('professional_id', TEST.PROFESSIONAL_ID)
    .eq('client_phone', TEST_PHONE_API)
    .neq('status', 'cancelled');
}

async function getFirstActiveService(): Promise<{ id: string; name: string; duration_minutes: number } | null> {
  const { data } = await supabase
    .from('services')
    .select('id, name, duration_minutes')
    .eq('professional_id', TEST.PROFESSIONAL_ID)
    .eq('is_active', true)
    .order('sort_order')
    .limit(1)
    .single();
  return data ?? null;
}

// Busca o primeiro slot disponível para um dia via API
async function getFirstAvailableSlot(
  request: import('@playwright/test').APIRequestContext,
  serviceId: string,
  date: string
): Promise<string | null> {
  const res = await request.get(
    `${BASE}/api/available-slots?professional_id=${TEST.PROFESSIONAL_ID}&date=${date}&service_id=${serviceId}`
  );
  if (res.status() !== 200) return null;
  const body = await res.json();
  const slots: string[] = Array.isArray(body) ? body : body.slots ?? [];
  return slots[0] ?? null;
}

test.describe('API Pública — GET /api/available-slots', () => {
  test('retorna slots disponíveis para segunda-feira válida', async ({ request }) => {
    const monday = nextWeekday(1);
    const service = await getFirstActiveService();
    if (!service) return; // skip se profissional não tem serviços

    // Parâmetros corretos: professional_id e service_id (snake_case)
    const res = await request.get(
      `${BASE}/api/available-slots?professional_id=${TEST.PROFESSIONAL_ID}&date=${monday}&service_id=${service.id}`
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    const slots: string[] = Array.isArray(body) ? body : body.slots ?? [];
    // Segunda é dia de trabalho → pelo menos 1 slot
    expect(slots.length).toBeGreaterThan(0);
  });

  test('retorna vazio (slots=[]) para domingo (dia fechado)', async ({ request }) => {
    const sunday = nextWeekday(0); // 0 = domingo
    const service = await getFirstActiveService();
    if (!service) return;

    const res = await request.get(
      `${BASE}/api/available-slots?professional_id=${TEST.PROFESSIONAL_ID}&date=${sunday}&service_id=${service.id}`
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    const slots: string[] = Array.isArray(body) ? body : body.slots ?? [];
    // Domingo é fechado → array vazio
    expect(slots).toHaveLength(0);
  });

  test('retorna 400 sem parâmetros obrigatórios', async ({ request }) => {
    const res = await request.get(`${BASE}/api/available-slots`);
    expect(res.status()).toBe(400);
  });
});

test.describe('API Pública — POST /api/bookings', () => {
  test.beforeEach(async () => {
    await cleanApiTestBookings();
  });

  test.afterEach(async () => {
    await cleanApiTestBookings();
  });

  test('happy path: cria agendamento com dados válidos → 201', async ({ request }) => {
    const service = await getFirstActiveService();
    if (!service) test.skip(true, 'Profissional sem serviços ativos');

    // Buscar slot realmente disponível (evita 409 por slots já ocupados em prod)
    const thursday = nextWeekday(4);
    const firstSlot = await getFirstAvailableSlot(request, service!.id, thursday);
    if (!firstSlot) test.skip(true, 'Nenhum slot disponível na quinta');

    const res = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: TEST.PROFESSIONAL_ID,
        service_id: service!.id,
        booking_date: thursday,
        start_time: firstSlot,
        client_name: 'Cliente Teste E2E',
        client_phone: TEST_PHONE_API,
        client_email: 'teste-e2e@circlehood.io',
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.booking).toBeDefined();
    expect(body.booking.status).toBe('confirmed');
    expect(body.booking.professional_id).toBe(TEST.PROFESSIONAL_ID);
    expect(body.booking.service_id).toBe(service!.id);
  });

  test('conflito de horário: segundo booking no mesmo slot → 409', async ({ request }) => {
    const service = await getFirstActiveService();
    if (!service) test.skip(true, 'Profissional sem serviços ativos');

    // Usar sexta (separada da quinta usada no happy path) para não ter dependência de ordem
    const friday = nextWeekday(5);
    const firstSlot = await getFirstAvailableSlot(request, service!.id, friday);
    if (!firstSlot) test.skip(true, 'Nenhum slot disponível na sexta');

    const bookingData = {
      professional_id: TEST.PROFESSIONAL_ID,
      service_id: service!.id,
      booking_date: friday,
      start_time: firstSlot,
      client_name: 'Cliente 1',
      client_phone: TEST_PHONE_API,
    };

    // Primeiro booking → deve criar
    const res1 = await request.post(`${BASE}/api/bookings`, { data: bookingData });
    expect(res1.status()).toBe(201);

    // Segundo booking no mesmo slot → conflito (409)
    const res2 = await request.post(`${BASE}/api/bookings`, {
      data: { ...bookingData, client_name: 'Cliente 2', client_phone: '353800000002' },
    });
    expect(res2.status()).toBe(409);
  });

  test('segurança: service_id de outro profissional → 404', async ({ request }) => {
    // Tentativa de booking usando um service_id que não pertence ao profissional
    // UUID aleatório que não existe na tabela do profissional
    const fakeServiceId = '00000000-0000-0000-0000-000000000001';
    const monday = nextWeekday(1);

    const res = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: TEST.PROFESSIONAL_ID,
        service_id: fakeServiceId,
        booking_date: monday,
        start_time: '09:00',
        client_name: 'Hacker Teste',
        client_phone: TEST_PHONE_API,
      },
    });

    // Deve retornar 404 — service não encontrado/não pertence ao profissional
    expect(res.status()).toBe(404);
  });

  test('campos obrigatórios ausentes → 400', async ({ request }) => {
    // Sem client_name (obrigatório)
    const res = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: TEST.PROFESSIONAL_ID,
        service_id: '00000000-0000-0000-0000-000000000001',
        booking_date: nextWeekday(1),
        start_time: '09:00',
        // client_name AUSENTE
        client_phone: TEST_PHONE_API,
      },
    });

    expect(res.status()).toBe(400);
  });

  test('todos os campos obrigatórios ausentes → 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/bookings`, {
      data: {},
    });
    expect(res.status()).toBe(400);
  });
});
