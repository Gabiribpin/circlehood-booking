/**
 * Testes de Conflito com pending_payment — Issue #3 (S2)
 *
 * Problema: POST /api/bookings só verificava conflitos com status='confirmed',
 * ignorando bookings 'pending_payment' (criados pelo checkout com depósito).
 * Isso permitia double-booking entre os dois fluxos.
 *
 * Fix: mudar .eq('status', 'confirmed') → .in('status', ['confirmed', 'pending_payment'])
 *
 * Phones dedicados: 353800000094-096 (não interferem em outros testes)
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { TEST } from '../helpers/config';
import { nextWeekday } from '../helpers/setup';

const BASE = TEST.BASE_URL;
const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);

const PHONE_A = '353800000094';
const PHONE_B = '353800000095';
const PHONE_C = '353800000096';
const ALL_PHONES = [PHONE_A, PHONE_B, PHONE_C];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function cleanTestBookings() {
  await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_by: 'system',
      cancellation_reason: 'pending_payment conflict E2E cleanup',
    })
    .eq('professional_id', TEST.PROFESSIONAL_ID)
    .in('client_phone', ALL_PHONES)
    .neq('status', 'cancelled');
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
  return data;
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

/** Insere booking diretamente no DB com status arbitrário (simula checkout/cancel). */
async function insertBookingWithStatus(
  serviceId: string,
  date: string,
  startTime: string,
  durationMinutes: number,
  phone: string,
  status: string,
) {
  const [h, m] = startTime.split(':').map(Number);
  const endTotal = h * 60 + m + durationMinutes;
  const endTime = `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      professional_id: TEST.PROFESSIONAL_ID,
      service_id: serviceId,
      booking_date: date,
      start_time: `${startTime}:00`,
      end_time: `${endTime}:00`,
      client_name: `Test ${status}`,
      client_phone: phone,
      status,
    })
    .select('id')
    .single();

  if (error) throw new Error(`insertBookingWithStatus failed: ${error.message}`);
  return data!.id;
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

test.beforeEach(async () => {
  await cleanTestBookings();
});

test.afterEach(async () => {
  await cleanTestBookings();
});

// ─── Testes ───────────────────────────────────────────────────────────────────

test.describe('pending_payment bloqueia double-booking (Issue #3)', () => {
  /**
   * Teste 1: booking pending_payment bloqueia POST /api/bookings → 409
   *
   * Cenário: Cliente A iniciou checkout (pending_payment).
   * Cliente B tenta agendar no mesmo slot via booking normal.
   * Deve receber 409.
   */
  test('booking pending_payment bloqueia novo booking no mesmo slot → 409', async ({
    request,
  }) => {
    const service = await getFirstActiveService();
    if (!service) return test.skip(true, 'Sem serviços ativos');

    // Usar quarta-feira para não conflitar com outros testes
    const wednesday = nextWeekday(3);
    const slot = await getFirstAvailableSlot(request, service.id, wednesday);
    if (!slot) return test.skip(true, 'Sem slots disponíveis na quarta');

    // 1. Inserir booking pending_payment diretamente (simula checkout iniciado)
    await insertBookingWithStatus(
      service.id,
      wednesday,
      slot,
      service.duration_minutes,
      PHONE_A,
      'pending_payment',
    );

    // 2. Tentar booking regular no MESMO slot
    const res = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: TEST.PROFESSIONAL_ID,
        service_id: service.id,
        booking_date: wednesday,
        start_time: slot,
        client_name: 'Cliente B Regular',
        client_phone: PHONE_B,
      },
    });

    // Deve ser 409 (slot ocupado por pending_payment)
    expect(res.status()).toBe(409);

    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  /**
   * Teste 2: booking confirmed bloqueia POST /api/bookings → 409 (regressão)
   *
   * Garante que o fix não quebrou o comportamento existente.
   */
  test('booking confirmed continua bloqueando → 409 (regressão)', async ({ request }) => {
    const service = await getFirstActiveService();
    if (!service) return test.skip(true, 'Sem serviços ativos');

    const thursday = nextWeekday(4);
    const slot = await getFirstAvailableSlot(request, service.id, thursday);
    if (!slot) return test.skip(true, 'Sem slots disponíveis na quinta');

    // 1. Inserir booking confirmed
    await insertBookingWithStatus(
      service.id,
      thursday,
      slot,
      service.duration_minutes,
      PHONE_A,
      'confirmed',
    );

    // 2. Tentar booking regular no MESMO slot
    const res = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: TEST.PROFESSIONAL_ID,
        service_id: service.id,
        booking_date: thursday,
        start_time: slot,
        client_name: 'Cliente B Regular',
        client_phone: PHONE_B,
      },
    });

    expect(res.status()).toBe(409);
  });

  /**
   * Teste 3: booking cancelled NÃO bloqueia → 201
   *
   * Garante que slots com bookings cancelados continuam livres.
   */
  test('booking cancelled não bloqueia novo booking → 201', async ({ request }) => {
    const service = await getFirstActiveService();
    if (!service) return test.skip(true, 'Sem serviços ativos');

    const friday = nextWeekday(5);
    const slot = await getFirstAvailableSlot(request, service.id, friday);
    if (!slot) return test.skip(true, 'Sem slots disponíveis na sexta');

    // 1. Inserir booking cancelled
    await insertBookingWithStatus(
      service.id,
      friday,
      slot,
      service.duration_minutes,
      PHONE_A,
      'cancelled',
    );

    // 2. Booking regular no MESMO slot → deve funcionar
    const res = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: TEST.PROFESSIONAL_ID,
        service_id: service.id,
        booking_date: friday,
        start_time: slot,
        client_name: 'Cliente B Regular',
        client_phone: PHONE_B,
      },
    });

    expect(res.status()).toBe(201);

    const body = await res.json();
    expect(body.booking).toBeTruthy();
    expect(body.booking.status).toBe('confirmed');
  });
});
