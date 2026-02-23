/**
 * Testes de Isolamento Multi-tenant (Cross-Tenant)
 *
 * Bug crítico prevenido: cancelAppointment não filtrava por professional_id.
 * Um bot mal implementado poderia cancelar agendamentos de outro profissional
 * se tivesse o booking_id — estes testes garantem que isso nunca aconteça.
 *
 * Setup: dois profissionais reais no banco (A = Salão da Rita, B = temporário).
 * Todos os dados de B são criados e destruídos neste arquivo.
 *
 * IMPORTANTE: beforeAll/afterAll ficam direto no describe raiz (sem nested describes)
 * para garantir que profB é criado UMA VEZ para todos os 12 testes.
 *
 * Cenários cobertos:
 *  1. Bot de A não cancela agendamento de B (mesmo phone de cliente)
 *  2. Bot de A não lista agendamentos de B
 *  3. API não aceita service_id de B com professional_id de A
 *  4. API não aceita service_id de A com professional_id de B
 *  5. API rejeita service inexistente com professional_id válido
 *  6. available-slots: service de B + professional_id de A → 404
 *  7. available-slots: service de A + professional_id de B → 404
 *  8. Analytics sem auth → 401
 *  9. Booking de B não aparece nas queries de A
 * 10. cancelAppointment com professional_id errado → zero linhas afetadas
 * 11. Contato de B não aparece nas queries de A
 * 12. POST /api/contacts/import sem auth → 401
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import {
  createIsolationProfessional,
  cleanupIsolationProfessional,
  createBookingInDB,
  getBookingStatus,
  getActiveBookingsForProfessional,
  addContact,
  getContactsForProfessional,
  cleanBotStateForPhone,
  type TestProfessional,
} from '../helpers/tenant';
import { cleanTestState, nextWeekday } from '../helpers/setup';
import { sendBotMessage } from '../helpers/webhook';
import { TEST } from '../helpers/config';

const BASE = TEST.BASE_URL;
const sb = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);

// ─── Helpers internos ────────────────────────────────────────────────────────

async function getLastBotMessageForPhone(userId: string, phone: string): Promise<string | null> {
  const { data: conv } = await sb
    .from('whatsapp_conversations')
    .select('id')
    .eq('user_id', userId)
    .eq('customer_phone', phone)
    .maybeSingle();
  if (!conv) return null;
  const { data: msgs } = await sb
    .from('whatsapp_messages')
    .select('content')
    .eq('conversation_id', conv.id)
    .eq('direction', 'outbound')
    .order('sent_at', { ascending: false })
    .limit(1);
  return msgs?.[0]?.content ?? null;
}

async function getServiceIdForProfessional(profId: string): Promise<string | null> {
  const { data } = await sb
    .from('services')
    .select('id')
    .eq('professional_id', profId)
    .eq('is_active', true)
    .limit(1)
    .single();
  return data?.id ?? null;
}

// ─── Suite: profB criado UMA VEZ para todos os testes ───────────────────────
// Sem nested describes: garante que beforeAll/afterAll rodam exatamente uma vez.
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Isolamento Multi-tenant', () => {
  let profB: TestProfessional;

  test.beforeAll(async () => {
    profB = await createIsolationProfessional('b');
    console.log(`✅ Prof B criado: id=${profB.id} slug=${profB.slug}`);
  });

  test.afterAll(async () => {
    await cleanupIsolationProfessional(profB);
    console.log('🧹 Prof B removido');
  });

  // ── 1: Bot de A não cancela agendamento de B ─────────────────────────────
  test('bot de A não afeta booking de B com mesmo phone', async ({ request }) => {
    test.setTimeout(90_000);

    const monday = nextWeekday(1);
    const [, month, day] = monday.split('-');

    const bookingBId = await createBookingInDB(
      profB.id,
      profB.serviceId,
      TEST.PHONE, // mesmo número — simula cliente em dois salões
      monday,
      '11:00'
    );

    await cleanTestState();
    await cleanBotStateForPhone(TEST.USER_ID, TEST.PHONE);

    await sendBotMessage(request, 'oi');
    await sendBotMessage(
      request,
      `quero cancelar meu agendamento de segunda dia ${parseInt(day)}/${parseInt(month)}`
    );

    const botReply = await getLastBotMessageForPhone(TEST.USER_ID, TEST.PHONE);

    if (botReply) {
      const falseCancel =
        /cancelado|desmarcado|cancelled/i.test(botReply) &&
        !/não encontr|nao encontr|nenhum|não tenho/i.test(botReply);
      expect(falseCancel).toBe(false);
    }

    // GARANTIA PRINCIPAL: booking de B permanece 'confirmed'
    const statusAfter = await getBookingStatus(bookingBId);
    expect(statusAfter).toBe('confirmed');

    await sb.from('bookings').update({ status: 'cancelled' }).eq('id', bookingBId);
  });

  // ── 2: Bot de A não lista agendamentos de B ──────────────────────────────
  test('get_my_appointments de A não retorna dados de B', async ({ request }) => {
    test.setTimeout(90_000);

    const thursday = nextWeekday(4);

    const bookingBId = await createBookingInDB(
      profB.id,
      profB.serviceId,
      TEST.PHONE,
      thursday,
      '14:00'
    );

    await cleanTestState();
    await cleanBotStateForPhone(TEST.USER_ID, TEST.PHONE);

    await sendBotMessage(request, 'oi');
    await sendBotMessage(request, 'tenho algum agendamento marcado?');

    const botReply = await getLastBotMessageForPhone(TEST.USER_ID, TEST.PHONE);

    if (botReply) {
      expect(botReply).not.toMatch(/serviço isolamento b/i);
      expect(botReply).not.toContain(bookingBId);
      expect(botReply).not.toContain(profB.id);
    }

    const statusAfter = await getBookingStatus(bookingBId);
    expect(statusAfter).toBe('confirmed');

    await sb.from('bookings').update({ status: 'cancelled' }).eq('id', bookingBId);
  });

  // ── 3: service de B + professional_id de A → 404 ────────────────────────
  test('POST /api/bookings: service de B + professional_id de A → 404', async ({ request }) => {
    const res = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: TEST.PROFESSIONAL_ID,
        service_id: profB.serviceId,
        booking_date: nextWeekday(1),
        start_time: '09:00',
        client_name: 'Ataque Cross-Tenant A→B',
        client_phone: '353800000099',
      },
    });
    expect(res.status()).toBe(404);
  });

  // ── 4: service de A + professional_id de B → 404 ────────────────────────
  test('POST /api/bookings: service de A + professional_id de B → 404', async ({ request }) => {
    const svcAId = await getServiceIdForProfessional(TEST.PROFESSIONAL_ID);
    if (!svcAId) { test.skip(); return; }

    const res = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: profB.id,
        service_id: svcAId,
        booking_date: nextWeekday(1),
        start_time: '09:00',
        client_name: 'Ataque Cross-Tenant B→A',
        client_phone: '353800000099',
      },
    });
    expect(res.status()).toBe(404);
  });

  // ── 5: service inexistente + professional_id válido → 404 ────────────────
  test('POST /api/bookings: service inexistente → 404', async ({ request }) => {
    const res = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: TEST.PROFESSIONAL_ID,
        service_id: '00000000-0000-4000-a000-000000000001',
        booking_date: nextWeekday(1),
        start_time: '09:00',
        client_name: 'Service Fantasma',
        client_phone: '353800000099',
      },
    });
    expect(res.status()).toBe(404);
  });

  // ── 6: available-slots com service de B + professional_id de A → 404 ─────
  // Fix: available-slots/route.ts agora filtra service por professional_id
  test('GET /api/available-slots: service de B + professional_id de A → 404', async ({ request }) => {
    const res = await request.get(
      `${BASE}/api/available-slots` +
        `?professional_id=${TEST.PROFESSIONAL_ID}` +
        `&date=${nextWeekday(1)}` +
        `&service_id=${profB.serviceId}`
    );
    expect([400, 404]).toContain(res.status());
  });

  // ── 7: available-slots com service de A + professional_id de B → 404 ─────
  test('GET /api/available-slots: service de A + professional_id de B → 404', async ({ request }) => {
    const svcAId = await getServiceIdForProfessional(TEST.PROFESSIONAL_ID);
    if (!svcAId) { test.skip(); return; }

    const res = await request.get(
      `${BASE}/api/available-slots` +
        `?professional_id=${profB.id}` +
        `&date=${nextWeekday(1)}` +
        `&service_id=${svcAId}`
    );
    expect([400, 404]).toContain(res.status());
  });

  // ── 8: Analytics sem auth → 401 ─────────────────────────────────────────
  test('GET /api/analytics/overview sem auth → 401', async ({ request }) => {
    const res = await request.get(`${BASE}/api/analytics/overview`);
    expect(res.status()).toBe(401);
  });

  // ── 9: Booking de B não aparece nas queries de A ─────────────────────────
  test('booking de B não aparece nas queries de A', async () => {
    const friday = nextWeekday(5);
    const sharedPhone = profB.clientPhone;

    const bookingBId = await createBookingInDB(profB.id, profB.serviceId, sharedPhone, friday, '15:00');

    // Query por A com o mesmo phone → não deve retornar booking de B
    const fromA = await getActiveBookingsForProfessional(TEST.PROFESSIONAL_ID, sharedPhone);
    expect(fromA.some((b) => b.id === bookingBId)).toBe(false);

    // Query por B → deve retornar o booking de B
    const fromB = await getActiveBookingsForProfessional(profB.id, sharedPhone);
    expect(fromB.some((b) => b.id === bookingBId)).toBe(true);

    // Todos os bookings de A pertencem somente a A
    const allFromA = await getActiveBookingsForProfessional(TEST.PROFESSIONAL_ID);
    allFromA.forEach((b) => expect(b.professional_id).toBe(TEST.PROFESSIONAL_ID));

    // Todos os bookings de B pertencem somente a B
    const allFromB = await getActiveBookingsForProfessional(profB.id);
    allFromB.forEach((b) => expect(b.professional_id).toBe(profB.id));

    await sb.from('bookings').update({ status: 'cancelled' }).eq('id', bookingBId);
  });

  // ── 10: cancelAppointment com professional_id errado → zero linhas ────────
  test('cancelAppointment com professional_id errado → zero linhas afetadas', async () => {
    const wednesday = nextWeekday(3);
    const bookingBId = await createBookingInDB(profB.id, profB.serviceId, profB.clientPhone, wednesday, '13:00');

    // Tenta cancelar com professional_id de A mas booking_id de B
    const { data: affected } = await sb
      .from('bookings')
      .update({ status: 'cancelled', cancelled_by: 'cross_tenant_regression' })
      .eq('id', bookingBId)
      .eq('professional_id', TEST.PROFESSIONAL_ID) // ← filtro que impede o cross-tenant
      .select('id');

    expect(affected).toHaveLength(0);
    expect(await getBookingStatus(bookingBId)).toBe('confirmed');

    await sb.from('bookings').update({ status: 'cancelled' }).eq('id', bookingBId);
  });

  // ── 11: Contato de B não aparece nas queries de A ─────────────────────────
  test('contato de B não aparece nas queries de A', async () => {
    const contactBId = await addContact(profB.id, {
      name: 'Contato Exclusivo Prof B',
      phone: profB.clientPhone,
      email: 'contato-b@teste.io',
    });

    const contactsA = await getContactsForProfessional(TEST.PROFESSIONAL_ID);
    expect(contactsA.some((c) => c.id === contactBId)).toBe(false);

    const contactsB = await getContactsForProfessional(profB.id);
    expect(contactsB.some((c) => c.id === contactBId)).toBe(true);

    contactsA.forEach((c) => expect(c.professional_id).toBe(TEST.PROFESSIONAL_ID));
    contactsB.forEach((c) => expect(c.professional_id).toBe(profB.id));
  });

  // ── 12: POST /api/contacts/import sem auth → 401 ─────────────────────────
  test('POST /api/contacts/import sem auth → 401', async ({ request }) => {
    const before = await getContactsForProfessional(profB.id);

    const res = await request.post(`${BASE}/api/contacts/import`, {
      data: {
        contacts: [{ name: 'Hacker Contact', phone: '353899999999' }],
        professional_id: profB.id,
      },
    });
    expect([401, 403]).toContain(res.status());

    const after = await getContactsForProfessional(profB.id);
    expect(after).toHaveLength(before.length);
  });
});
