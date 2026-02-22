/**
 * Testes de Reagendamento via Bot WhatsApp
 *
 * Cenários cobertos:
 *  1. Cliente com 1 agendamento pede para reagendar → bot confirma nova data/hora
 *  2. Cliente com 2 agendamentos especifica qual reagendar → only esse é alterado
 *
 * NOTA: Estes testes chamam a API Anthropic (Claude).
 * Rodar apenas localmente ou quando necessário.
 * No CI: desabilitado por padrão (if: false no workflow).
 *
 * Execução local:
 *   npx playwright test --project=bot-reschedule
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { TEST } from '../helpers/config';
import { cleanTestState, getLastBotMessage, nextWeekday } from '../helpers/setup';
import { sendBotMessage } from '../helpers/webhook';

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

async function createTestBooking(
  serviceId: string,
  date: string,
  startTime: string,
  endTime: string,
) {
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      professional_id: TEST.PROFESSIONAL_ID,
      service_id: serviceId,
      client_name: 'Cliente Reagendamento E2E',
      client_phone: TEST.PHONE,
      booking_date: date,
      start_time: startTime,
      end_time: endTime,
      status: 'confirmed',
      notes: 'Criado por teste de reagendamento E2E',
    })
    .select('id, booking_date, start_time')
    .single();

  if (error) throw new Error(`Falha ao criar booking de teste: ${error.message}`);
  return data!;
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

test.beforeEach(async () => {
  await cleanTestState();
});

test.afterEach(async () => {
  await cleanTestState();
});

// ─── Testes ───────────────────────────────────────────────────────────────────

test.describe('Bot — Reagendamento', () => {
  /**
   * Teste 1: Reagendamento simples (1 agendamento)
   *
   * Setup: 1 booking confirmado na segunda às 10h
   * Fluxo:
   *  - "oi" → saudação (sem Claude)
   *  - "quero reagendar meu horário de segunda para quarta às 14h"
   *    → bot: get_my_appointments → reschedule_appointment → confirma
   *
   * DB esperado: booking original cancelado, novo booking criado (quarta 14:00)
   */
  test('reagendamento simples: 1 booking → bot usa reschedule_appointment', async ({
    request,
  }) => {
    test.setTimeout(90_000);

    const service = await getFirstActiveService();
    if (!service) test.skip(true, 'Sem serviços ativos');

    // Usar segunda (dia de trabalho confirmado)
    const monday = nextWeekday(1);
    const originalBooking = await createTestBooking(service!.id, monday, '10:00:00', '12:00:00');

    // Usar quarta para reagendar (diferente da segunda)
    const wednesday = nextWeekday(3);
    const [wDay, wMonth] = wednesday.split('-').slice(1).reverse().map(Number);

    // Turno 1: Saudação (bypass Claude — sem crédito)
    await sendBotMessage(request, 'oi');
    const greeting = await getLastBotMessage();
    expect(greeting).not.toBeNull();

    // Turno 2: Pedido de reagendamento com nova data/hora em uma mensagem só
    // Minimiza turnos para reduzir uso de créditos Claude
    await sendBotMessage(
      request,
      `quero reagendar meu horário de segunda para quarta dia ${wDay}/${wMonth} às 14h`,
    );
    const response = await getLastBotMessage(greeting!);
    expect(response).not.toBeNull();

    // Bot deve confirmar o reagendamento
    expect(response!.toLowerCase()).toMatch(
      /reagendado|confirmado|marcado|agendado|quarta|14:00|14h/i,
    );
    // Não deve pedir "cancelar e criar novo" manualmente
    expect(response!.toLowerCase()).not.toMatch(/cancela.*cria|cancele.*depois.*crie/i);

    // Verificar DB: booking original deve estar cancelado
    const { data: original } = await supabase
      .from('bookings')
      .select('status')
      .eq('id', originalBooking.id)
      .single();

    expect(original?.status).toBe('cancelled');

    // Verificar DB: novo booking criado na quarta às 14:00
    const { data: newBookings } = await supabase
      .from('bookings')
      .select('id, start_time, status')
      .eq('professional_id', TEST.PROFESSIONAL_ID)
      .eq('client_phone', TEST.PHONE)
      .eq('booking_date', wednesday)
      .eq('status', 'confirmed');

    expect(newBookings).not.toBeNull();
    expect(newBookings!.length).toBe(1);
    expect(newBookings![0].start_time).toMatch(/^14:/);
  });

  /**
   * Teste 2: Múltiplos agendamentos — reagendar apenas o correto
   *
   * Setup: 2 bookings confirmados (segunda 10h e terça 15h)
   * Fluxo:
   *  - "oi" → saudação (sem Claude)
   *  - "quero reagendar o horário de segunda para quarta às 11h"
   *    → bot: get_my_appointments → identifica segunda → reschedule_appointment → confirma
   *
   * DB esperado:
   *  - Booking da segunda: CANCELADO
   *  - Booking da terça: INTACTO (ainda confirmado)
   *  - Novo booking na quarta 11:00: CRIADO
   */
  test('múltiplos agendamentos: apenas o selecionado é reagendado', async ({ request }) => {
    test.setTimeout(90_000);

    const service = await getFirstActiveService();
    if (!service) test.skip(true, 'Sem serviços ativos');

    const monday = nextWeekday(1);
    const tuesday = nextWeekday(2);

    // Criar 2 bookings
    const mondayBooking = await createTestBooking(service!.id, monday, '10:00:00', '12:00:00');
    const tuesdayBooking = await createTestBooking(service!.id, tuesday, '15:00:00', '17:00:00');

    // Usar quarta para reagendar a segunda
    const wednesday = nextWeekday(3);
    const [wDay, wMonth] = wednesday.split('-').slice(1).reverse().map(Number);

    // Turno 1: Saudação (bypass Claude)
    await sendBotMessage(request, 'oi');
    const greeting = await getLastBotMessage();
    expect(greeting).not.toBeNull();

    // Turno 2: Especificar qual reagendar + nova data/hora
    await sendBotMessage(
      request,
      `quero reagendar o horário de segunda para quarta dia ${wDay}/${wMonth} às 11h`,
    );
    const response = await getLastBotMessage(greeting!);
    expect(response).not.toBeNull();

    // Bot deve confirmar o reagendamento
    expect(response!.toLowerCase()).toMatch(/reagendado|confirmado|marcado|agendado|quarta|11:00|11h/i);

    // DB: booking da segunda deve estar CANCELADO
    const { data: mondayResult } = await supabase
      .from('bookings')
      .select('status')
      .eq('id', mondayBooking.id)
      .single();
    expect(mondayResult?.status).toBe('cancelled');

    // DB: booking da terça deve estar INTACTO (confirmed)
    const { data: tuesdayResult } = await supabase
      .from('bookings')
      .select('status')
      .eq('id', tuesdayBooking.id)
      .single();
    expect(tuesdayResult?.status).toBe('confirmed');

    // DB: novo booking na quarta às 11:00 criado
    const { data: newBookings } = await supabase
      .from('bookings')
      .select('id, start_time, status')
      .eq('professional_id', TEST.PROFESSIONAL_ID)
      .eq('client_phone', TEST.PHONE)
      .eq('booking_date', wednesday)
      .eq('status', 'confirmed');

    expect(newBookings).not.toBeNull();
    expect(newBookings!.length).toBe(1);
    expect(newBookings![0].start_time).toMatch(/^11:/);
  });
});
