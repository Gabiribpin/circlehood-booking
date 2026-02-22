/**
 * Testes de Consistência: Bot ↔ Página Pública
 *
 * Valida que o bot e a página de agendamento público usam a mesma fonte de
 * verdade (tabela bookings), sem cache stale entre os dois lados.
 *
 * Cenários:
 *  1. Slot livre na API → bot confirma disponibilidade
 *  2. Slot ocupado via DB direto → página e bot concordam que está indisponível
 *  3. Booking criado pela página (POST /api/bookings) → bot lista imediatamente
 *  4. Booking criado pelo bot → página remove slot de available-slots imediatamente
 *
 * NOTA: Todos os testes chamam a API Anthropic (Claude).
 * CI: desabilitado por padrão (if: false no workflow).
 *
 * Execução local:
 *   npx playwright test --project=consistency-bot-page
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { TEST } from '../helpers/config';
import { cleanTestState, getLastBotMessage, nextWeekday } from '../helpers/setup';
import { sendBotMessage } from '../helpers/webhook';

const BASE = TEST.BASE_URL;
const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

test.beforeEach(async () => {
  await cleanTestState();
});

test.afterEach(async () => {
  await cleanTestState();
});

// ─── Testes ───────────────────────────────────────────────────────────────────

test.describe('Consistência Bot ↔ Página Pública', () => {
  /**
   * Teste 1: Slot livre na API → bot confirma disponibilidade
   *
   * Fonte de verdade: DB não tem booking no slot.
   * Página: /api/available-slots retorna o slot.
   * Bot: ao perguntar disponibilidade, bot responde que está livre.
   */
  test('slot livre: página e bot concordam que está disponível', async ({ request }) => {
    test.setTimeout(90_000);

    const service = await getFirstActiveService();
    if (!service) test.skip(true, 'Sem serviços ativos');

    const monday = nextWeekday(1);
    const slots = await getAvailableSlots(request, service!.id, monday);
    if (slots.length === 0) test.skip(true, 'Sem slots disponíveis na segunda');

    const slot = slots[0]; // ex: "10:00"
    const [hours] = slot.split(':');
    const [day, month] = monday.split('-').slice(1).reverse().map(Number);

    // PÁGINA: slot aparece na lista de disponíveis (fonte de verdade = DB vazio)
    expect(slots).toContain(slot);

    // BOT: perguntar disponibilidade → deve confirmar que está livre
    await sendBotMessage(request, 'oi');
    const greeting = await getLastBotMessage();
    expect(greeting).not.toBeNull();

    await sendBotMessage(
      request,
      `você tem horário disponível no dia ${day}/${month} às ${hours}h?`,
    );
    const botResponse = await getLastBotMessage(greeting!);
    expect(botResponse).not.toBeNull();

    // Bot deve confirmar disponibilidade — não negar
    expect(botResponse!.toLowerCase()).toMatch(/disponív|sim|livre|pode|tem horário|tenho/i);
    expect(botResponse!.toLowerCase()).not.toMatch(/ocupado|indisponív|não tenho horário/i);
  });

  /**
   * Teste 2: Slot ocupado via DB direto → página e bot concordam que está indisponível
   *
   * Cenário: booking inserido diretamente no banco (bypass da API pública).
   * Garante que ambas as camadas lêem o DB em tempo real, sem cache stale.
   *
   * Página: slot some de /api/available-slots imediatamente.
   * Bot: ao perguntar disponibilidade, responde que está ocupado.
   */
  test('slot ocupado: página e bot concordam que está indisponível', async ({ request }) => {
    test.setTimeout(90_000);

    const service = await getFirstActiveService();
    if (!service) test.skip(true, 'Sem serviços ativos');

    const monday = nextWeekday(1);
    const slotsBefore = await getAvailableSlots(request, service!.id, monday);
    if (slotsBefore.length === 0) test.skip(true, 'Sem slots disponíveis na segunda');

    const slot = slotsBefore[0]; // ex: "10:00"
    const endMinutes =
      parseInt(slot.split(':')[0]) * 60 +
      parseInt(slot.split(':')[1]) +
      service!.duration_minutes;
    const endH = Math.floor(endMinutes / 60).toString().padStart(2, '0');
    const endM = (endMinutes % 60).toString().padStart(2, '0');

    // Criar booking diretamente no DB (simula qualquer fonte — sem passar pela API)
    const { error } = await supabase.from('bookings').insert({
      professional_id: TEST.PROFESSIONAL_ID,
      service_id: service!.id,
      client_name: 'Cliente Consistência E2E',
      client_phone: TEST.PHONE,
      booking_date: monday,
      start_time: `${slot}:00`,
      end_time: `${endH}:${endM}:00`,
      status: 'confirmed',
      notes: 'Criado por teste de consistência E2E',
    });
    if (error) throw new Error(`Falha ao criar booking: ${error.message}`);

    // PÁGINA: slot deve ter sumido de available-slots imediatamente
    const slotsAfter = await getAvailableSlots(request, service!.id, monday);
    expect(slotsAfter).not.toContain(slot);

    // BOT: perguntar disponibilidade → deve dizer que está ocupado
    const [hours] = slot.split(':');
    const [day, month] = monday.split('-').slice(1).reverse().map(Number);

    await sendBotMessage(request, 'oi');
    const greeting = await getLastBotMessage();
    expect(greeting).not.toBeNull();

    await sendBotMessage(
      request,
      `você tem horário disponível no dia ${day}/${month} às ${hours}h?`,
    );
    const botResponse = await getLastBotMessage(greeting!);
    expect(botResponse).not.toBeNull();

    // Bot deve negar disponibilidade
    expect(botResponse!.toLowerCase()).toMatch(
      /ocupado|indisponív|não tenho|não está|sem horário|lotado|outro horário/i,
    );
  });

  /**
   * Teste 3: Booking criado pela página → bot lista imediatamente
   *
   * Cenário: cliente usa a página pública (POST /api/bookings) para agendar.
   * Imediatamente após, o bot deve listar o booking via get_my_appointments.
   *
   * Valida: não há cache stale — bot enxerga em tempo real o que a página criou.
   */
  test('booking via página → bot lista via get_my_appointments imediatamente', async ({
    request,
  }) => {
    test.setTimeout(90_000);

    const service = await getFirstActiveService();
    if (!service) test.skip(true, 'Sem serviços ativos');

    const monday = nextWeekday(1);
    const slots = await getAvailableSlots(request, service!.id, monday);
    if (slots.length === 0) test.skip(true, 'Sem slots disponíveis na segunda');

    const slot = slots[0];
    const [hours] = slot.split(':');

    // PÁGINA: criar booking via API pública (mesmo endpoint que a página usa)
    const createRes = await request.post(`${BASE}/api/bookings`, {
      data: {
        professional_id: TEST.PROFESSIONAL_ID,
        service_id: service!.id,
        client_name: 'Cliente Consistência E2E',
        client_phone: TEST.PHONE,
        booking_date: monday,
        start_time: slot,
      },
    });
    expect(createRes.status()).toBe(201);

    // BOT: listar agendamentos — deve incluir o booking criado pela página
    await sendBotMessage(request, 'oi');
    const greeting = await getLastBotMessage();
    expect(greeting).not.toBeNull();

    await sendBotMessage(request, 'quais são meus agendamentos?');
    const botResponse = await getLastBotMessage(greeting!);
    expect(botResponse).not.toBeNull();

    // Bot deve mencionar a data ou horário do agendamento
    const [day, month] = monday.split('-').slice(1).reverse().map(Number);
    const mentionsBooking =
      botResponse!.includes(String(day)) ||
      botResponse!.toLowerCase().includes('segunda') ||
      botResponse!.includes(hours);

    expect(mentionsBooking).toBe(true);
    // Não deve dizer "sem agendamentos" ou similar
    expect(botResponse!.toLowerCase()).not.toMatch(/sem agendamento|nenhum agendamento|não encontr/i);
  });

  /**
   * Teste 4: Booking criado pelo bot → página remove slot imediatamente
   *
   * Cenário: cliente usa o bot WhatsApp para agendar.
   * Após confirmação do bot, a página não deve mais mostrar o slot.
   *
   * Valida: não há cache stale — a página enxerga em tempo real o que o bot criou.
   */
  test('booking via bot → página remove slot de available-slots imediatamente', async ({
    request,
  }) => {
    test.setTimeout(90_000);

    const service = await getFirstActiveService();
    if (!service) test.skip(true, 'Sem serviços ativos');

    const monday = nextWeekday(1);
    const slotsBefore = await getAvailableSlots(request, service!.id, monday);
    if (slotsBefore.length === 0) test.skip(true, 'Sem slots disponíveis na segunda');

    const slot = slotsBefore[0]; // ex: "10:00"
    const [hours] = slot.split(':');
    const [day, month] = monday.split('-').slice(1).reverse().map(Number);

    // BOT: criar booking via webhook (simula fluxo real do WhatsApp)
    await sendBotMessage(request, 'oi');
    const greeting = await getLastBotMessage();
    expect(greeting).not.toBeNull();

    await sendBotMessage(
      request,
      `quero agendar ${service!.name} para o dia ${day}/${month} às ${hours}h. Meu nome é Cliente Consistência`,
    );
    const botResponse = await getLastBotMessage(greeting!);
    expect(botResponse).not.toBeNull();

    // Bot deve confirmar o agendamento
    expect(botResponse!.toLowerCase()).toMatch(/confirmado|agendado|marcado|reservado/i);

    // PÁGINA: slot deve ter sumido de available-slots imediatamente
    const slotsAfter = await getAvailableSlots(request, service!.id, monday);
    expect(slotsAfter).not.toContain(slot);

    // DB: booking confirmado deve existir
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, status')
      .eq('professional_id', TEST.PROFESSIONAL_ID)
      .eq('client_phone', TEST.PHONE)
      .eq('booking_date', monday)
      .eq('status', 'confirmed');

    expect(bookings).not.toBeNull();
    expect(bookings!.length).toBeGreaterThan(0);
  });
});
