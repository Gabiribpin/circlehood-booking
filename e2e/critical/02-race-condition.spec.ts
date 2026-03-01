/**
 * Testes de Race Condition — Prevenção de overbooking
 *
 * Problema real: sem proteção, dois clientes que clicam "confirmar" ao mesmo
 * tempo para o MESMO horário passam ambos pelo SELECT de conflito antes de
 * qualquer INSERT, criando 2 bookings confirmados no mesmo slot.
 *
 * Resultado sem proteção: profissional com 2 clientes no mesmo horário = CAOS.
 *
 * Proteção implementada em 2 camadas:
 *  1. App-level: SELECT de sobreposição antes de inserir (check-then-act)
 *  2. DB-level:  partial unique index em (professional_id, booking_date, start_time)
 *               WHERE status = 'confirmed' — garante consistência atômica mesmo
 *               com requests simultâneos que passem pelo check da camada 1.
 *
 * Phones dedicados: 353800000091-093 (não interferem em outros testes)
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { TEST } from '../helpers/config';
import { nextWeekday } from '../helpers/setup';

const BASE = TEST.BASE_URL;
const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);

// Phones dedicados para testes de race condition
const TEST_PHONE_RACE_1 = '353800000091'; // Simula Cliente A
const TEST_PHONE_RACE_2 = '353800000092'; // Simula Cliente B
const TEST_PHONE_RACE_3 = '353800000093'; // Simula Cliente C

const ALL_RACE_PHONES = [TEST_PHONE_RACE_1, TEST_PHONE_RACE_2, TEST_PHONE_RACE_3];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function cleanRaceTestBookings() {
  await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_by: 'system',
      cancellation_reason: 'Race condition E2E cleanup',
    })
    .eq('professional_id', TEST.PROFESSIONAL_ID)
    .in('client_phone', ALL_RACE_PHONES)
    .neq('status', 'cancelled');
}

/** Conta bookings confirmados para um slot específico, apenas dos phones de teste. */
async function countConfirmedRaceBookings(date: string, startTime: string): Promise<number> {
  const { count } = await supabase
    .from('bookings')
    .select('id', { count: 'exact' })
    .eq('professional_id', TEST.PROFESSIONAL_ID)
    .eq('booking_date', date)
    .eq('start_time', `${startTime}:00`) // DB armazena "HH:MM:00"
    .eq('status', 'confirmed')
    .in('client_phone', ALL_RACE_PHONES);
  return count ?? 0;
}

async function getFirstActiveService() {
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

async function getFirstAvailableSlot(
  request: import('@playwright/test').APIRequestContext,
  serviceId: string,
  date: string,
): Promise<string | null> {
  const res = await request.get(
    `${BASE}/api/available-slots?professional_id=${TEST.PROFESSIONAL_ID}&date=${date}&service_id=${serviceId}`,
  );
  if (res.status() !== 200) return null;
  const body = await res.json();
  const slots: string[] = Array.isArray(body) ? body : (body.slots ?? []);
  return slots[0] ?? null;
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

test.beforeEach(async () => {
  await cleanRaceTestBookings();
});

test.afterEach(async () => {
  await cleanRaceTestBookings();
});

// ─── Testes ───────────────────────────────────────────────────────────────────

test.describe('Race Condition — Prevenção de overbooking', () => {
  /**
   * Teste 1: 2 clientes simultâneos no MESMO slot
   *
   * Dispara 2 POST simultâneos com dados de clientes DIFERENTES para o mesmo
   * horário. Sem o unique index no banco, ambos passariam pelo SELECT de
   * conflito antes de qualquer INSERT → overbooking.
   *
   * Com o unique index: apenas 1 INSERT é aceito, o outro recebe 23505 →
   * a API retorna 409. Exatamente 1 booking confirmado no banco.
   */
  test('2 clientes simultâneos no mesmo slot → apenas 1 booking confirmado', async ({
    request,
  }) => {
    const service = await getFirstActiveService();
    if (!service) test.skip(true, 'Sem serviços ativos');

    const monday = nextWeekday(1);
    const slot = await getFirstAvailableSlot(request, service!.id, monday);
    if (!slot) test.skip(true, 'Sem slots disponíveis na segunda');

    const baseBooking = {
      professional_id: TEST.PROFESSIONAL_ID,
      service_id: service!.id,
      booking_date: monday,
      start_time: slot,
    };

    // Dois clientes diferentes tentando o MESMO slot SIMULTANEAMENTE
    const [res1, res2] = await Promise.all([
      request.post(`${BASE}/api/bookings`, {
        data: { ...baseBooking, client_name: 'Cliente Race A', client_phone: TEST_PHONE_RACE_1 },
      }),
      request.post(`${BASE}/api/bookings`, {
        data: { ...baseBooking, client_name: 'Cliente Race B', client_phone: TEST_PHONE_RACE_2 },
      }),
    ]);

    const status1 = res1.status();
    const status2 = res2.status();

    // Exatamente 1 deve ter sucedido (201) e 1 deve ter sido rejeitado (409)
    const successCount = [status1, status2].filter((s) => s === 201).length;
    const conflictCount = [status1, status2].filter((s) => s === 409).length;

    expect(successCount).toBe(1);
    expect(conflictCount).toBe(1);

    // DB: apenas 1 booking confirmado para este slot
    const dbCount = await countConfirmedRaceBookings(monday, slot!);
    expect(dbCount).toBe(1);
  });

  /**
   * Teste 2: 3 clientes simultâneos no MESMO slot
   *
   * Teste mais agressivo. 3 requests concorrentes — o unique index deve
   * garantir que apenas o primeiro INSERT seja aceito.
   */
  test('3 clientes simultâneos no mesmo slot → apenas 1 booking confirmado', async ({
    request,
  }) => {
    const service = await getFirstActiveService();
    if (!service) test.skip(true, 'Sem serviços ativos');

    // Usar terça para não depender de cleanup do Teste 1
    const tuesday = nextWeekday(2);
    const slot = await getFirstAvailableSlot(request, service!.id, tuesday);
    if (!slot) test.skip(true, 'Sem slots disponíveis na terça');

    const baseBooking = {
      professional_id: TEST.PROFESSIONAL_ID,
      service_id: service!.id,
      booking_date: tuesday,
      start_time: slot,
    };

    const clients = [
      { client_name: 'Cliente Race A', client_phone: TEST_PHONE_RACE_1 },
      { client_name: 'Cliente Race B', client_phone: TEST_PHONE_RACE_2 },
      { client_name: 'Cliente Race C', client_phone: TEST_PHONE_RACE_3 },
    ];

    // 3 clients tentando o MESMO slot SIMULTANEAMENTE
    const responses = await Promise.all(
      clients.map((client) =>
        request.post(`${BASE}/api/bookings`, { data: { ...baseBooking, ...client } }),
      ),
    );

    const statuses = await Promise.all(responses.map((r) => r.status()));
    const successCount = statuses.filter((s) => s === 201).length;
    const conflictCount = statuses.filter((s) => s === 409).length;

    // Exatamente 1 sucesso, os demais todos como conflito
    expect(successCount).toBe(1);
    expect(conflictCount).toBe(2);

    // Total: 3 (sem outros erros além de 201 e 409)
    expect(successCount + conflictCount).toBe(3);

    // DB: apenas 1 booking confirmado para este slot
    const dbCount = await countConfirmedRaceBookings(tuesday, slot!);
    expect(dbCount).toBe(1);
  });

  /**
   * Teste 3: Cliente perdedor recebe resposta clara de "ocupado"
   *
   * Verifica:
   *  a) Slot ocupado retorna 409 (não 500)
   *  b) Corpo da resposta contém mensagem de erro clara
   *  c) Slot ocupado deixa de aparecer em /api/available-slots
   *  d) Não cria booking duplicado no DB
   */
  test('segundo cliente recebe 409 com mensagem clara + slot sai da disponibilidade', async ({
    request,
  }) => {
    const service = await getFirstActiveService();
    if (!service) test.skip(true, 'Sem serviços ativos');

    const thursday = nextWeekday(4);
    const slot = await getFirstAvailableSlot(request, service!.id, thursday);
    if (!slot) test.skip(true, 'Sem slots disponíveis na quinta');

    const baseBooking = {
      professional_id: TEST.PROFESSIONAL_ID,
      service_id: service!.id,
      booking_date: thursday,
      start_time: slot,
    };

    // 1. Primeiro cliente reserva o slot com sucesso
    const res1 = await request.post(`${BASE}/api/bookings`, {
      data: { ...baseBooking, client_name: 'Primeiro Chegou', client_phone: TEST_PHONE_RACE_1 },
    });
    expect(res1.status()).toBe(201);

    // 2. Segundo cliente tenta o mesmo slot
    const res2 = await request.post(`${BASE}/api/bookings`, {
      data: { ...baseBooking, client_name: 'Chegou Tarde', client_phone: TEST_PHONE_RACE_2 },
    });

    // a) Deve retornar 409 (não 200, não 500)
    expect(res2.status()).toBe(409);

    // b) Corpo deve ter mensagem clara de conflito
    const body2 = await res2.json();
    expect(body2.error).toBeTruthy();
    const errLower = (body2.error as string).toLowerCase();
    const hasClearMessage =
      errLower.includes('indisponível') ||
      errLower.includes('ocupado') ||
      errLower.includes('horario');
    expect(hasClearMessage).toBe(true);

    // c) Slot não deve aparecer mais em available-slots
    const slotsRes = await request.get(
      `${BASE}/api/available-slots?professional_id=${TEST.PROFESSIONAL_ID}&date=${thursday}&service_id=${service!.id}`,
    );
    expect(slotsRes.status()).toBe(200);
    const slotsBody = await slotsRes.json();
    const availableSlots: string[] = Array.isArray(slotsBody)
      ? slotsBody
      : (slotsBody.slots ?? []);
    expect(availableSlots).not.toContain(slot!);

    // d) Apenas 1 booking no banco (não duplicou)
    const dbCount = await countConfirmedRaceBookings(thursday, slot!);
    expect(dbCount).toBe(1);
  });
});
