/**
 * Auto-save de Contatos — POST /api/bookings
 *
 * Valida que após um agendamento bem-sucedido:
 *  1. O contato é criado automaticamente na tabela `contacts`
 *  2. Um segundo agendamento do mesmo telefone não duplica o contato
 *
 * Sem browser — testes de API pura.
 * CI habilitado (projeto api-tests).
 *
 * Execução local:
 *   npx playwright test --project=api-tests e2e/api/03-autosave-contacts.spec.ts
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { TEST } from '../helpers/config';
import { nextWeekday } from '../helpers/setup';

const BASE = TEST.BASE_URL;
const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);

// Telefone dedicado para este arquivo (não interfere em outros testes)
const TEST_PHONE = '353800099001';
const TEST_NAME = 'Contato AutoSave E2E';

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

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

async function cleanup() {
  // Cancelar agendamentos do telefone de teste
  await supabase
    .from('bookings')
    .update({ status: 'cancelled', cancelled_by: 'system', cancellation_reason: 'autosave E2E cleanup' })
    .eq('professional_id', TEST.PROFESSIONAL_ID)
    .eq('client_phone', TEST_PHONE)
    .neq('status', 'cancelled');

  // Remover contato criado pelo teste
  await supabase
    .from('contacts')
    .delete()
    .eq('professional_id', TEST.PROFESSIONAL_ID)
    .eq('phone', TEST_PHONE);
}

test.beforeAll(async () => {
  await cleanup();
});

test.afterAll(async () => {
  await cleanup();
});

test.describe('Auto-save de Contatos', () => {
  test('agendamento cria contato automaticamente', async ({ request }) => {
    const service = await getFirstActiveService();
    if (!service) test.skip();

    const date = nextWeekday(3); // próxima quarta
    const slot = await getFirstAvailableSlot(request, service!.id, date);
    if (!slot) test.skip();

    // Criar agendamento via API pública
    const res = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: TEST.PROFESSIONAL_ID,
        service_id: service!.id,
        booking_date: date,
        start_time: slot,
        client_name: TEST_NAME,
        client_phone: TEST_PHONE,
      },
    });

    // 429 é aceitável se rate limit atingido (todos E2E compartilham IP no CI)
    expect([200, 201, 429]).toContain(res.status());
    if (res.status() === 429) test.skip(true, 'Rate limited no CI');

    // Aguardar auto-save (fire-and-forget — pequeno delay)
    await new Promise((r) => setTimeout(r, 2_000));

    // Verificar que contato foi criado
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, name, phone')
      .eq('professional_id', TEST.PROFESSIONAL_ID)
      .eq('phone', TEST_PHONE)
      .maybeSingle();

    expect(contact).not.toBeNull();
    expect(contact!.name).toBe(TEST_NAME);
    expect(contact!.phone).toBe(TEST_PHONE);
  });

  test('segundo agendamento do mesmo telefone não duplica contato', async ({ request }) => {
    const service = await getFirstActiveService();
    if (!service) test.skip();

    // Garantir que já existe 1 contato do teste anterior
    const { data: before } = await supabase
      .from('contacts')
      .select('id')
      .eq('professional_id', TEST.PROFESSIONAL_ID)
      .eq('phone', TEST_PHONE);

    // Se o teste anterior não rodou / não criou contato, seed manual
    if (!before || before.length === 0) {
      await supabase.from('contacts').insert({
        professional_id: TEST.PROFESSIONAL_ID,
        name: TEST_NAME,
        phone: TEST_PHONE,
      });
    }

    const date = nextWeekday(4); // próxima quinta (dia diferente do teste anterior)
    const slot = await getFirstAvailableSlot(request, service!.id, date);
    if (!slot) test.skip();

    // Segundo agendamento com mesmo telefone
    const res = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: TEST.PROFESSIONAL_ID,
        service_id: service!.id,
        booking_date: date,
        start_time: slot,
        client_name: TEST_NAME,
        client_phone: TEST_PHONE,
      },
    });

    // 429 é aceitável se rate limit atingido (todos E2E compartilham IP no CI)
    expect([200, 201, 429]).toContain(res.status());
    if (res.status() === 429) test.skip(true, 'Rate limited no CI');

    // Aguardar auto-save
    await new Promise((r) => setTimeout(r, 2_000));

    // Deve existir EXATAMENTE 1 contato (sem duplicata)
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id')
      .eq('professional_id', TEST.PROFESSIONAL_ID)
      .eq('phone', TEST_PHONE);

    expect(contacts).not.toBeNull();
    expect(contacts!.length).toBe(1);
  });
});
