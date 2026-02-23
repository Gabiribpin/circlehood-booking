/**
 * Validação de Dados — POST /api/bookings
 *
 * Valida que a API rejeita dados malformados e sanitiza XSS:
 *  A. Payload incompleto (falta client_name) → 400
 *  B. Data no passado → 400
 *  C. Horário com formato inválido → 400
 *  D. UUID inválido para professional_id → 400
 *  E. Serviço inexistente (UUID válido mas não existe) → 404
 *  F. XSS em client_name → 201 com nome sanitizado (sem <script>)
 *  G. Email inválido → 400
 *
 * Projeto: validation (sem browser, API pura)
 *
 * Execução local:
 *   npx playwright test --project=validation e2e/validation/01-malformed-data.spec.ts
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { TEST } from '../helpers/config';
import { nextWeekday } from '../helpers/setup';

const BASE = TEST.BASE_URL;
const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);

const XSS_PHONE = '353800066001';

async function getFirstActiveService(): Promise<{ id: string } | null> {
  const { data } = await supabase
    .from('services')
    .select('id')
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
    .update({ status: 'cancelled', cancelled_by: 'system', cancellation_reason: 'validation E2E cleanup' })
    .eq('professional_id', TEST.PROFESSIONAL_ID)
    .eq('client_phone', XSS_PHONE)
    .neq('status', 'cancelled');
}

test.beforeAll(async () => { await cleanup(); });
test.afterAll(async () => { await cleanup(); });

test.describe('Validação — Dados Malformados', () => {
  test('A: falta client_name → 400', async ({ request }) => {
    const service = await getFirstActiveService();
    const date = nextWeekday(3);

    const res = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: TEST.PROFESSIONAL_ID,
        service_id: service?.id ?? '00000000-0000-0000-0000-000000000000',
        booking_date: date,
        start_time: '10:00',
        // client_name ausente
        client_phone: '353800000099',
      },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test('B: data no passado → 400', async ({ request }) => {
    const service = await getFirstActiveService();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2);
    const pastDate = yesterday.toISOString().split('T')[0];

    const res = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: TEST.PROFESSIONAL_ID,
        service_id: service?.id ?? '00000000-0000-0000-0000-000000000000',
        booking_date: pastDate,
        start_time: '10:00',
        client_name: 'Teste Passado',
        client_phone: '353800000099',
      },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/pass|data|date/i);
  });

  test('C: horário inválido (25:00) → 400', async ({ request }) => {
    const service = await getFirstActiveService();
    const date = nextWeekday(3);

    const res = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: TEST.PROFESSIONAL_ID,
        service_id: service?.id ?? '00000000-0000-0000-0000-000000000000',
        booking_date: date,
        start_time: '25:00',
        client_name: 'Teste Hora Inválida',
        client_phone: '353800000099',
      },
    });

    expect(res.status()).toBe(400);
  });

  test('D: professional_id não é UUID → 400', async ({ request }) => {
    const res = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: 'nao-e-um-uuid',
        service_id: '00000000-0000-0000-0000-000000000001',
        booking_date: nextWeekday(3),
        start_time: '10:00',
        client_name: 'Teste UUID Inválido',
        client_phone: '353800000099',
      },
    });

    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  test('E: serviço inexistente (UUID válido) → 404', async ({ request }) => {
    const res = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: TEST.PROFESSIONAL_ID,
        service_id: '00000000-0000-0000-0000-000000000001', // UUID válido mas não existe
        booking_date: nextWeekday(3),
        start_time: '10:00',
        client_name: 'Teste Serviço Inexistente',
        client_phone: '353800000099',
      },
    });

    expect(res.status()).toBe(404);
  });

  test('F: XSS em client_name → 201, nome sanitizado (sem <script>)', async ({ request }) => {
    const service = await getFirstActiveService();
    if (!service) test.skip();

    const date = nextWeekday(4); // próxima quinta
    const slot = await getFirstAvailableSlot(request, service!.id, date);
    if (!slot) test.skip();

    const res = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: TEST.PROFESSIONAL_ID,
        service_id: service!.id,
        booking_date: date,
        start_time: slot,
        client_name: "<script>alert('xss')</script>Maria",
        client_phone: XSS_PHONE,
      },
    });

    // Sistema aceita (sanitiza, não rejeita)
    expect([200, 201]).toContain(res.status());

    const body = await res.json();
    if (body.booking) {
      // Nome armazenado não deve conter tags HTML
      expect(body.booking.client_name).not.toContain('<script>');
      expect(body.booking.client_name).not.toContain('</script>');
      // Parte segura deve estar presente
      expect(body.booking.client_name).toContain('Maria');
    }
  });

  test('G: email inválido → 400', async ({ request }) => {
    const service = await getFirstActiveService();
    const date = nextWeekday(3);

    const res = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: TEST.PROFESSIONAL_ID,
        service_id: service?.id ?? '00000000-0000-0000-0000-000000000000',
        booking_date: date,
        start_time: '10:00',
        client_name: 'Teste Email Inválido',
        client_phone: '353800000099',
        client_email: 'email-invalido-sem-arroba',
      },
    });

    expect(res.status()).toBe(400);
  });
});
