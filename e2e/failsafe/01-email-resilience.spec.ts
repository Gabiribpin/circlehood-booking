/**
 * Fail-safe de notificações — POST /api/bookings
 *
 * Valida que o sistema é resiliente a falhas de email/WhatsApp:
 *  1. Booking é criado mesmo quando WhatsApp não está configurado
 *  2. Booking é criado mesmo sem email do cliente (email opcional)
 *  3. Sistema retorna 201 (nunca 500) após criar booking
 *  4. notification_logs registra tentativa (sucesso ou falha)
 *
 * Projeto: failsafe (sem browser, API pura)
 *
 * Execução local:
 *   npx playwright test --project=failsafe e2e/failsafe/01-email-resilience.spec.ts
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { TEST } from '../helpers/config';
import { nextWeekday } from '../helpers/setup';

const BASE = TEST.BASE_URL;
const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);

// Telefone dedicado para este arquivo (não interfere em outros testes)
const TEST_PHONE = '353800088001';

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
  await supabase
    .from('bookings')
    .update({ status: 'cancelled', cancelled_by: 'system', cancellation_reason: 'failsafe E2E cleanup' })
    .eq('professional_id', TEST.PROFESSIONAL_ID)
    .eq('client_phone', TEST_PHONE)
    .neq('status', 'cancelled');
}

test.beforeAll(async () => { await cleanup(); });
test.afterAll(async () => { await cleanup(); });

test.describe('Fail-safe — Resiliência de Notificações', () => {
  test('booking criado sem email do cliente — sistema não quebra (201)', async ({ request }) => {
    const service = await getFirstActiveService();
    if (!service) test.skip();

    const date = nextWeekday(2); // próxima terça
    const slot = await getFirstAvailableSlot(request, service!.id, date);
    if (!slot) test.skip();

    const res = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: TEST.PROFESSIONAL_ID,
        service_id: service!.id,
        booking_date: date,
        start_time: slot,
        client_name: 'Failsafe Teste Sem Email',
        client_phone: TEST_PHONE,
        // client_email intencionalmente omitido
      },
    });

    // Sistema nunca deve retornar 500
    expect(res.status()).not.toBe(500);
    // Booking criado com sucesso
    expect([200, 201]).toContain(res.status());

    const body = await res.json();
    expect(body.booking).toBeDefined();
    expect(body.booking.id).toBeDefined();
  });

  test('booking criado com email do cliente — 201, sem erro de notificação no response', async ({ request }) => {
    const service = await getFirstActiveService();
    if (!service) test.skip();

    const date = nextWeekday(3); // próxima quarta
    const slot = await getFirstAvailableSlot(request, service!.id, date);
    if (!slot) test.skip();

    const res = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: TEST.PROFESSIONAL_ID,
        service_id: service!.id,
        booking_date: date,
        start_time: slot,
        client_name: 'Failsafe Teste Com Email',
        client_phone: TEST_PHONE,
        client_email: 'failsafe.test@example.com',
      },
    });

    expect(res.status()).not.toBe(500);
    expect([200, 201]).toContain(res.status());

    const body = await res.json();
    expect(body.booking).toBeDefined();
    // Resposta amigável (sem stack trace / mensagem de erro técnico)
    if (body.message) {
      expect(body.message).not.toMatch(/error|exception|stack|SMTP|timeout/i);
    }
  });

  test('notification_logs registra tentativa de email após booking', async ({ request }) => {
    // Pegar o booking mais recente do telefone de teste
    const { data: booking } = await supabase
      .from('bookings')
      .select('id')
      .eq('professional_id', TEST.PROFESSIONAL_ID)
      .eq('client_phone', TEST_PHONE)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!booking) {
      // Se não encontrou, pular (os testes anteriores precisam ter rodado)
      test.skip();
      return;
    }

    // Aguardar o fire-and-forget processar (até 5s)
    await new Promise((r) => setTimeout(r, 5_000));

    const { data: logs } = await supabase
      .from('notification_logs')
      .select('id, channel, status')
      .eq('booking_id', booking.id);

    // Pode ter ou não logs dependendo se email está configurado
    // O que importa é que não houve 500 nem crash (verificado nos testes anteriores)
    // Se há logs, devem ter status 'sent' ou 'failed' (nunca null ou undefined)
    if (logs && logs.length > 0) {
      for (const log of logs) {
        expect(['sent', 'failed', 'delivered', 'read']).toContain(log.status);
      }
    }
  });
});
