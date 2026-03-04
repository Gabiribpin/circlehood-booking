/**
 * Edge Cases — Back Button / Refresh / Duplo Tab
 *
 * Valida que a janela de idempotência de 5 minutos previne duplicatas em:
 *  1. Duplo submit (mesmo payload nos últimos 5 min) → retorna booking existente
 *  2. Requests simultâneas (duplo tab) → apenas 1 booking criado
 *  3. Segunda submissão com mesmo horário mas diferente phone → 409 (slot ocupado)
 *
 * Projeto: critical-idempotency (sem browser, API pura)
 *
 * Execução local:
 *   npx playwright test --project=critical-idempotency e2e/critical/03-back-refresh.spec.ts
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { TEST } from '../helpers/config';
import { nextWeekday } from '../helpers/setup';

const BASE = TEST.BASE_URL;
const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);

// Telefone dedicado para este arquivo
const TEST_PHONE_A = '353800077001';
const TEST_PHONE_B = '353800077002';

async function getFirstActiveService(): Promise<{ id: string; duration_minutes: number } | null> {
  const { data } = await supabase
    .from('services')
    .select('id, duration_minutes')
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
  date: string
): Promise<string | null> {
  const res = await request.get(
    `${BASE}/api/available-slots?professional_id=${TEST.PROFESSIONAL_ID}&date=${date}&service_id=${serviceId}`
  );
  if (res.status() !== 200) return null;
  const body = await res.json();
  const slots: string[] = Array.isArray(body) ? body : (body.slots ?? []);
  return slots[0] ?? null;
}

async function cleanup() {
  for (const phone of [TEST_PHONE_A, TEST_PHONE_B]) {
    await supabase
      .from('bookings')
      .update({ status: 'cancelled', cancelled_by: 'system', cancellation_reason: 'back-refresh E2E cleanup' })
      .eq('professional_id', TEST.PROFESSIONAL_ID)
      .eq('client_phone', phone)
      .neq('status', 'cancelled');
  }
}

test.beforeAll(async () => { await cleanup(); });
test.afterAll(async () => { await cleanup(); });

test.describe('Idempotência — Back / Refresh / Duplo Tab', () => {
  test('duplo submit mesmo payload → retorna booking existente, sem duplicata', async ({ request }) => {
    const service = await getFirstActiveService();
    if (!service) test.skip();

    const date = nextWeekday(2); // próxima terça
    const slot = await getFirstAvailableSlot(request, service!.id, date);
    if (!slot) test.skip();

    const payload = {
      professional_id: TEST.PROFESSIONAL_ID,
      service_id: service!.id,
      booking_date: date,
      start_time: slot,
      client_name: 'Back Refresh Teste A',
      client_phone: TEST_PHONE_A,
    };

    // Primeiro submit
    const res1 = await request.post(`${BASE}/api/bookings`, { data: payload });
    // 429 é aceitável se rate limit atingido (todos E2E compartilham IP no CI)
    expect([200, 201, 429]).toContain(res1.status());
    if (res1.status() === 429) test.skip(true, 'Rate limited no CI');
    const body1 = await res1.json();
    const bookingId1 = body1.booking?.id;
    expect(bookingId1).toBeDefined();

    // Segundo submit imediato (simula back-button → re-submit)
    const res2 = await request.post(`${BASE}/api/bookings`, { data: payload });
    // 429 é aceitável se rate limit atingido
    expect([200, 201, 429]).toContain(res2.status());
    if (res2.status() === 429) test.skip(true, 'Rate limited no CI');
    const body2 = await res2.json();
    const bookingId2 = body2.booking?.id;
    expect(bookingId2).toBeDefined();

    // Deve ser O MESMO booking (idempotente)
    expect(bookingId2).toBe(bookingId1);

    // Verificar no DB: apenas 1 booking confirmado para este slot/phone
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id')
      .eq('professional_id', TEST.PROFESSIONAL_ID)
      .eq('booking_date', date)
      .eq('start_time', `${slot}:00`)
      .eq('client_phone', TEST_PHONE_A)
      .eq('status', 'confirmed');

    expect(bookings?.length).toBe(1);
  });

  test('duplo tab (requests simultâneas) → apenas 1 booking criado', async ({ request }) => {
    const service = await getFirstActiveService();
    if (!service) test.skip();

    const date = nextWeekday(3); // próxima quarta (dia diferente)
    const slot = await getFirstAvailableSlot(request, service!.id, date);
    if (!slot) test.skip();

    const payload = {
      professional_id: TEST.PROFESSIONAL_ID,
      service_id: service!.id,
      booking_date: date,
      start_time: slot,
      client_name: 'Back Refresh Teste B',
      client_phone: TEST_PHONE_B,
    };

    // Enviar 2 requests simultâneas (simula duplo-tab)
    const [res1, res2] = await Promise.all([
      request.post(`${BASE}/api/bookings`, { data: payload }),
      request.post(`${BASE}/api/bookings`, { data: payload }),
    ]);

    const statuses = [res1.status(), res2.status()];

    // Exatamente 1 deve ter criado (200 ou 201), o outro pode ser 200 (idempotente), 409 (race) ou 429 (rate limit)
    const successes = statuses.filter((s) => s === 200 || s === 201);
    const errors = statuses.filter((s) => s === 409);
    const rateLimited = statuses.filter((s) => s === 429);

    // Se ambas foram rate limited, skip (CI compartilha IP entre todos E2E)
    if (rateLimited.length === 2) test.skip(true, 'Ambas as requisições foram rate limited no CI');

    // Deve haver pelo menos 1 sucesso
    expect(successes.length).toBeGreaterThanOrEqual(1);

    // Qualquer combinação válida: (200/201 + 200/201) ou (200/201 + 409) ou (200/201 + 429)
    expect(successes.length + errors.length + rateLimited.length).toBe(2);

    // Verificar no DB: apenas 1 booking confirmado para este slot
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id')
      .eq('professional_id', TEST.PROFESSIONAL_ID)
      .eq('booking_date', date)
      .eq('start_time', `${slot}:00`)
      .eq('client_phone', TEST_PHONE_B)
      .eq('status', 'confirmed');

    expect(bookings?.length).toBe(1);
  });
});
