/**
 * Teste E2E — Ciclo completo de cancelamento
 *
 * CENÁRIO CRÍTICO: Cancelar booking → slot volta a ficar disponível → novo cliente pode agendar.
 *
 * Sem este teste, um bug no filtro de status do available-slots pode causar:
 *  - Slot permanece "ocupado" após cancelamento → perda de vendas
 *  - Profissional perde horário sem motivo
 *
 * Cobre:
 *  1. Criar booking → slot some de available-slots
 *  2. Cancelar booking (status → cancelled)
 *  3. Slot reaparece em available-slots
 *  4. Novo cliente consegue agendar no slot reaberto (201)
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { TEST } from '../helpers/config';
import { nextWeekday } from '../helpers/setup';

const BASE = TEST.BASE_URL;
const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);

// Phone dedicado para este teste — evita colisão com outros
const PHONE_CANCEL_A = '353800000030';
const PHONE_CANCEL_B = '353800000031';

async function cleanupCancelTestBookings() {
  await supabase
    .from('bookings')
    .update({ status: 'cancelled', cancelled_by: 'system', cancellation_reason: 'Cancel cycle E2E cleanup' })
    .eq('professional_id', TEST.PROFESSIONAL_ID)
    .in('client_phone', [PHONE_CANCEL_A, PHONE_CANCEL_B])
    .neq('status', 'cancelled');
}

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

async function getAvailableSlots(
  request: import('@playwright/test').APIRequestContext,
  serviceId: string,
  date: string
): Promise<string[]> {
  const res = await request.get(
    `${BASE}/api/available-slots?professional_id=${TEST.PROFESSIONAL_ID}&date=${date}&service_id=${serviceId}`
  );
  if (res.status() !== 200) return [];
  const body = await res.json();
  return Array.isArray(body) ? body : body.slots ?? [];
}

test.describe('Cancelamento — Slot Reabre', () => {
  test.beforeEach(async () => {
    await cleanupCancelTestBookings();
  });

  test.afterAll(async () => {
    await cleanupCancelTestBookings();
  });

  test('ciclo completo: criar → slot some → cancelar → slot volta → novo booking funciona', async ({ request }) => {
    const service = await getFirstActiveService();
    if (!service) test.skip(true, 'Profissional sem servicos ativos');

    // Usar quarta-feira para não colidir com outros testes (segunda/quinta/sexta já usados)
    const wednesday = nextWeekday(3);

    // ─── 1. Buscar slots disponíveis ANTES ──────────────────────────
    const slotsBefore = await getAvailableSlots(request, service!.id, wednesday);
    if (slotsBefore.length === 0) test.skip(true, 'Nenhum slot disponivel na quarta');

    // Escolher um slot do meio do dia (menos chance de conflito com outros testes)
    const targetSlot = slotsBefore.find(s => s >= '13:00' && s <= '16:00') ?? slotsBefore[0];

    // ─── 2. Criar booking no slot ──────────────────────────────────
    const createRes = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: TEST.PROFESSIONAL_ID,
        service_id: service!.id,
        booking_date: wednesday,
        start_time: targetSlot,
        client_name: 'Cancel Cycle A',
        client_phone: PHONE_CANCEL_A,
      },
    });

    // Handle idempotency (200) or fresh creation (201)
    expect([200, 201]).toContain(createRes.status());
    const { booking } = await createRes.json();
    expect(booking.id).toBeDefined();
    expect(booking.status).toBe('confirmed');

    // ─── 3. Verificar: slot SUMIU de available-slots ────────────────
    const slotsAfterBooking = await getAvailableSlots(request, service!.id, wednesday);
    const slotStillAvailable = slotsAfterBooking.includes(targetSlot);
    expect(slotStillAvailable).toBe(false);

    // ─── 4. CANCELAR booking via DB (simula profissional cancelando) ─
    const { error: cancelError } = await supabase
      .from('bookings')
      .update({
        status: 'cancelled',
        cancelled_by: 'professional',
        cancellation_reason: 'E2E cancel cycle test',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', booking.id);

    expect(cancelError).toBeNull();

    // Verificar status no DB
    const { data: cancelledBooking } = await supabase
      .from('bookings')
      .select('status')
      .eq('id', booking.id)
      .single();
    expect(cancelledBooking!.status).toBe('cancelled');

    // ─── 5. CRITICAL: Verificar que slot VOLTOU para available-slots ─
    const slotsAfterCancel = await getAvailableSlots(request, service!.id, wednesday);
    const slotReopened = slotsAfterCancel.includes(targetSlot);
    expect(slotReopened).toBe(true);

    // ─── 6. BONUS: Novo cliente consegue agendar no slot reaberto ──
    const rebookRes = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: TEST.PROFESSIONAL_ID,
        service_id: service!.id,
        booking_date: wednesday,
        start_time: targetSlot,
        client_name: 'Cancel Cycle B',
        client_phone: PHONE_CANCEL_B,
      },
    });

    expect(rebookRes.status()).toBe(201);
    const { booking: newBooking } = await rebookRes.json();
    expect(newBooking.status).toBe('confirmed');
    expect(newBooking.start_time).toContain(targetSlot);
  });
});
