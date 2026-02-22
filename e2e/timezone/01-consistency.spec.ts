/**
 * Testes de Timezone e DST (Daylight Saving Time)
 *
 * Valida que:
 *  1. Profissional tem timezone configurado (Europe/Dublin)
 *  2. Horários são armazenados no formato local (HH:MM:SS) sem conversão UTC
 *  3. Datas de transição DST (março/outubro) preservam horários locais
 *  4. /api/available-slots filtra slots passados usando timezone correto (Dublin)
 *  5. "Hoje" é calculado no timezone do profissional, não em UTC puro
 *
 * Sem Claude. CI habilitado.
 *
 * Contexto:
 *  - Profissional em Dublin (Europe/Dublin = GMT no inverno, BST = UTC+1 no verão)
 *  - DST Europa 2026: início 29/03 (GMT→BST), fim 25/10 (BST→GMT)
 *  - Vercel roda em UTC: sem o fix, às 23:30 UTC = 00:30 BST, o filtro "hoje"
 *    usaria a data UTC errada, mostrando slots já passados.
 *
 * Execução local:
 *   npx playwright test --project=timezone-dst
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { TEST } from '../helpers/config';
import { nextWeekday } from '../helpers/setup';

const BASE = TEST.BASE_URL;
const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);

const cleanupBookingIds: string[] = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getFirstActiveService() {
  const { data } = await supabase
    .from('services')
    .select('id, duration_minutes')
    .eq('professional_id', TEST.PROFESSIONAL_ID)
    .eq('is_active', true)
    .limit(1)
    .single();
  return data ?? null;
}

async function getAvailableSlots(
  request: import('@playwright/test').APIRequestContext,
  serviceId: string,
  date: string,
): Promise<string[]> {
  const res = await request.get(
    `${BASE}/api/available-slots?professional_id=${TEST.PROFESSIONAL_ID}&date=${date}&service_id=${serviceId}`,
  );
  if (res.status() !== 200) return [];
  const body = await res.json();
  return Array.isArray(body) ? body : (body.slots ?? []);
}

// ─── Teardown ─────────────────────────────────────────────────────────────────

test.afterAll(async () => {
  if (cleanupBookingIds.length > 0) {
    await supabase
      .from('bookings')
      .update({ status: 'cancelled', cancelled_by: 'system', cancellation_reason: 'Timezone E2E cleanup' })
      .in('id', cleanupBookingIds)
      .neq('status', 'cancelled');
  }
});

// ─── Testes ───────────────────────────────────────────────────────────────────

test.describe('Timezone — Configuração e Preservação', () => {
  /**
   * Teste 1: Profissional tem timezone configurado
   *
   * Confirma que a coluna timezone existe e está preenchida com um valor
   * IANA válido. Sem timezone configurado, nenhum dos outros mecanismos funciona.
   */
  test('profissional tem timezone configurado (Europe/Dublin)', async () => {
    const { data: professional, error } = await supabase
      .from('professionals')
      .select('id, timezone')
      .eq('id', TEST.PROFESSIONAL_ID)
      .single();

    expect(error).toBeNull();
    expect(professional).not.toBeNull();
    expect(professional!.timezone).toBeTruthy();

    // Deve ser um timezone IANA válido (contém '/')
    expect(professional!.timezone).toContain('/');

    // Para profissional de Dublin, deve ser Europe/Dublin
    expect(professional!.timezone).toBe('Europe/Dublin');

    console.log(`✅ Timezone configurado: ${professional!.timezone}`);
  });

  /**
   * Teste 2: Horário salvo no banco = horário enviado pela API (sem conversão UTC)
   *
   * Cria um agendamento via POST /api/bookings com start_time="15:00"
   * e verifica que o banco armazena "15:00:00" — não "14:00:00" (UTC) nem "16:00:00".
   *
   * Este é o teste mais importante: garante que nenhuma conversão UTC acidental ocorre.
   */
  test('start_time salvo = start_time enviado (sem conversão UTC)', async ({ request }) => {
    const service = await getFirstActiveService();
    if (!service) test.skip(true, 'Sem serviços ativos');

    const monday = nextWeekday(1);
    const sentTime = '15:00';

    const res = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: TEST.PROFESSIONAL_ID,
        service_id: service!.id,
        client_name: 'Timezone E2E Test',
        client_phone: '353800000097',
        booking_date: monday,
        start_time: sentTime,
      },
    });

    if (res.status() === 409) {
      test.skip(true, 'Slot já ocupado — tente com outro horário');
      return;
    }
    expect(res.status()).toBe(201);

    const booking = await res.json();
    if (booking?.id) cleanupBookingIds.push(booking.id);

    // Verificar no DB
    const bookingId = booking?.id ?? booking?.booking?.id;
    if (!bookingId) {
      // Buscar pelo phone+data
      const { data: found } = await supabase
        .from('bookings')
        .select('id, start_time')
        .eq('professional_id', TEST.PROFESSIONAL_ID)
        .eq('client_phone', '353800000097')
        .eq('booking_date', monday)
        .eq('status', 'confirmed')
        .maybeSingle();

      expect(found).not.toBeNull();
      expect(found!.start_time).toMatch(/^15:00/); // 15:00:00
      if (found?.id) cleanupBookingIds.push(found.id);
      console.log(`✅ start_time salvo: ${found!.start_time} (enviado: ${sentTime})`);
      return;
    }

    const { data: savedBooking } = await supabase
      .from('bookings')
      .select('start_time')
      .eq('id', bookingId)
      .single();

    expect(savedBooking!.start_time).toMatch(/^15:00/);
    console.log(`✅ start_time salvo: ${savedBooking!.start_time} (enviado: ${sentTime})`);
  });
});

test.describe('DST — Transição Março/Outubro', () => {
  /**
   * Teste 3: Agendamento antes de DST (25/03/2026) preserva horário local
   *
   * Em 29/03/2026 a Europa muda de GMT para BST (UTC+1).
   * Um agendamento em 25/03 às 10:00 (GMT) deve ser salvo como 10:00:00,
   * não como 09:00:00 (UTC-1) ou 11:00:00 (BST).
   */
  test('booking em data antes de DST (25/03) preserva 10:00 local', async () => {
    const service = await getFirstActiveService();
    if (!service) test.skip(true, 'Sem serviços ativos');

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        professional_id: TEST.PROFESSIONAL_ID,
        service_id: service!.id,
        client_name: 'DST Before E2E',
        client_phone: '353800000094',
        booking_date: '2026-03-25', // Quarta antes do DST (29/03)
        start_time: '10:00:00',
        end_time: `${String(10 + Math.ceil(service!.duration_minutes / 60)).padStart(2, '0')}:00:00`,
        status: 'confirmed',
        notes: 'DST test — before transition',
      })
      .select('id, start_time, booking_date')
      .single();

    expect(error).toBeNull();
    expect(data!.start_time).toMatch(/^10:00/);
    expect(data!.booking_date).toBe('2026-03-25');

    cleanupBookingIds.push(data!.id);
    console.log(`✅ Antes de DST (25/03): start_time=${data!.start_time} ✓`);
  });

  /**
   * Teste 4: Agendamento depois de DST (01/04/2026) preserva horário local
   *
   * Após DST (BST = UTC+1), 10:00 local em Dublin = 09:00 UTC.
   * O sistema NÃO deve converter — deve salvar 10:00:00 como enviado.
   */
  test('booking em data depois de DST (01/04) preserva 10:00 local', async () => {
    const service = await getFirstActiveService();
    if (!service) test.skip(true, 'Sem serviços ativos');

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        professional_id: TEST.PROFESSIONAL_ID,
        service_id: service!.id,
        client_name: 'DST After E2E',
        client_phone: '353800000093',
        booking_date: '2026-04-01', // Quarta após DST (29/03)
        start_time: '10:00:00',
        end_time: `${String(10 + Math.ceil(service!.duration_minutes / 60)).padStart(2, '0')}:00:00`,
        status: 'confirmed',
        notes: 'DST test — after transition',
      })
      .select('id, start_time, booking_date')
      .single();

    expect(error).toBeNull();
    expect(data!.start_time).toMatch(/^10:00/);
    expect(data!.booking_date).toBe('2026-04-01');

    cleanupBookingIds.push(data!.id);
    console.log(`✅ Depois de DST (01/04): start_time=${data!.start_time} ✓`);
  });

  /**
   * Teste 5: Ambas as datas DST têm o MESMO start_time (consistência)
   *
   * Confirma que a transição DST não causa inconsistência entre agendamentos.
   * Um agendamento às 10:00 em março deve ter o mesmo start_time que um às 10:00 em abril.
   */
  test('start_time é consistente antes e depois de DST (ambos 10:00)', async () => {
    const { data: bookings } = await supabase
      .from('bookings')
      .select('start_time, booking_date')
      .eq('professional_id', TEST.PROFESSIONAL_ID)
      .in('booking_date', ['2026-03-25', '2026-04-01'])
      .in('client_phone', ['353800000094', '353800000093'])
      .neq('status', 'cancelled')
      .order('booking_date');

    if (!bookings || bookings.length < 2) {
      // Testes 3 e 4 podem não ter rodado ainda — skip gracioso
      console.log('⚠️ Bookings DST não encontrados — rodar testes 3 e 4 primeiro');
      return;
    }

    const times = bookings.map((b) => b.start_time.slice(0, 5));
    expect(times[0]).toBe(times[1]); // Ambos devem ser '10:00'
    console.log(`✅ Consistência DST: antes=${times[0]}, depois=${times[1]}`);
  });
});

test.describe('Timezone — available-slots API', () => {
  /**
   * Teste 6: /available-slots retorna array vazio para data passada
   *
   * Datas no passado não devem ter slots disponíveis.
   * Testa que a API rejeita datas passadas (pelo mecanismo de working_hours
   * ou pela lógica do "hoje").
   */
  test('available-slots retorna vazio ou estrutura válida para data de ontem', async ({
    request,
  }) => {
    const service = await getFirstActiveService();
    if (!service) test.skip(true, 'Sem serviços ativos');

    // Ontem em Dublin (usando UTC-offset para simular)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const slots = await getAvailableSlots(request, service!.id, yesterdayStr);

    // Data passada nunca deve ter slots (todos já passaram)
    expect(slots).toHaveLength(0);
    console.log(`✅ Data passada (${yesterdayStr}): 0 slots disponíveis`);
  });

  /**
   * Teste 7: /available-slots retorna slots razoáveis para próxima semana
   *
   * Datas futuras devem ter slots disponíveis (se é dia de trabalho).
   * Os horários devem estar em formato HH:MM e dentro do horário de trabalho esperado.
   */
  test('available-slots retorna slots em formato HH:MM para data futura', async ({ request }) => {
    const service = await getFirstActiveService();
    if (!service) test.skip(true, 'Sem serviços ativos');

    const monday = nextWeekday(1);
    const slots = await getAvailableSlots(request, service!.id, monday);

    if (slots.length === 0) {
      // Segunda pode ser folga
      console.log('⚠️ Segunda não tem slots (folga configurada?)');
      return;
    }

    // Todos os slots devem ser strings no formato HH:MM
    const timeRegex = /^\d{2}:\d{2}$/;
    for (const slot of slots) {
      expect(slot).toMatch(timeRegex);
    }

    // Horários devem ser razoáveis (08:00–20:00 para Dublin)
    const hours = slots.map((s) => parseInt(s.split(':')[0]));
    const minHour = Math.min(...hours);
    const maxHour = Math.max(...hours);

    expect(minHour).toBeGreaterThanOrEqual(7);
    expect(maxHour).toBeLessThanOrEqual(22);

    console.log(
      `✅ Slots para ${monday}: ${slots.length} slots, ${slots[0]}–${slots[slots.length - 1]}`,
    );
  });

  /**
   * Teste 8: "Hoje" calculado em Europe/Dublin, não em UTC puro
   *
   * Verifica que a API não retorna slots já passados para "hoje".
   * Não é possível testar a borda da meia-noite em CI (sem controlar o clock),
   * mas podemos verificar que slots do passado de hoje não aparecem.
   *
   * O fix garante que dublinNow.getHours() (BST ou GMT) é usado para
   * comparação, não now.getHours() (UTC no Vercel).
   */
  test('slots já passados hoje não aparecem em available-slots', async ({ request }) => {
    const service = await getFirstActiveService();
    if (!service) test.skip(true, 'Sem serviços ativos');

    // Dublin "hoje" — usando Europe/Dublin para cálculo local do teste
    const dublinNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Dublin' }));
    const todayDublin = `${dublinNow.getFullYear()}-${String(dublinNow.getMonth() + 1).padStart(2, '0')}-${String(dublinNow.getDate()).padStart(2, '0')}`;
    const currentMinutes = dublinNow.getHours() * 60 + dublinNow.getMinutes();

    const slots = await getAvailableSlots(request, service!.id, todayDublin);

    // Nenhum slot deve ser anterior ao horário atual de Dublin
    for (const slot of slots) {
      const [h, m] = slot.split(':').map(Number);
      const slotMinutes = h * 60 + m;
      expect(slotMinutes).toBeGreaterThan(currentMinutes);
    }

    console.log(
      `✅ Slots de hoje (${todayDublin}): ${slots.length} slots futuros, hora atual Dublin: ${dublinNow.getHours()}:${String(dublinNow.getMinutes()).padStart(2, '0')}`,
    );
  });
});
