/**
 * Testes de Bot — Bloqueio de Período / Férias
 *
 * Valida que o bot rejeita agendamentos em datas bloqueadas:
 *  - blocked_dates (dia único)
 *  - blocked_periods (range — férias)
 * E aceita agendamentos fora dos períodos bloqueados.
 *
 * NOTA: Estes testes chamam a API Anthropic (Claude).
 * CI: desabilitado por padrão (if: false no workflow).
 *
 * Execução local:
 *   npx playwright test --project=blocked-periods-bot
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { TEST } from '../helpers/config';
import { cleanTestState, getLastBotMessage, nextWeekday } from '../helpers/setup';
import { sendBotMessage } from '../helpers/webhook';

const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);

const cleanupBlockedDates: string[] = [];
const cleanupBlockedPeriods: string[] = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function blockDate(date: string, reason: string): Promise<string> {
  const { data, error } = await supabase
    .from('blocked_dates')
    .insert({ professional_id: TEST.PROFESSIONAL_ID, blocked_date: date, reason })
    .select('id')
    .single();
  if (error) throw new Error(`Falha ao bloquear data: ${error.message}`);
  return data!.id;
}

async function blockPeriod(startDate: string, endDate: string, reason: string): Promise<string> {
  const { data, error } = await supabase
    .from('blocked_periods')
    .insert({
      professional_id: TEST.PROFESSIONAL_ID,
      start_date: startDate,
      end_date: endDate,
      reason,
    })
    .select('id')
    .single();
  if (error) throw new Error(`Falha ao criar período bloqueado: ${error.message}`);
  return data!.id;
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

test.beforeEach(async () => {
  await cleanTestState();
});

test.afterEach(async () => {
  await cleanTestState();
  if (cleanupBlockedDates.length > 0) {
    await supabase.from('blocked_dates').delete().in('id', cleanupBlockedDates);
    cleanupBlockedDates.length = 0;
  }
  if (cleanupBlockedPeriods.length > 0) {
    await supabase.from('blocked_periods').delete().in('id', cleanupBlockedPeriods);
    cleanupBlockedPeriods.length = 0;
  }
});

// ─── Testes ───────────────────────────────────────────────────────────────────

test.describe('Bot — Rejeição de Agendamento em Período Bloqueado', () => {
  /**
   * Teste 1: Bot rejeita agendamento em dia bloqueado (blocked_dates)
   *
   * Setup: blocked_dates para próxima segunda.
   * Cliente tenta agendar na segunda → bot deve rejeitar.
   */
  test('bot rejeita agendamento em dia bloqueado (blocked_dates)', async ({ request }) => {
    test.setTimeout(90_000);

    const monday = nextWeekday(1);
    const blockId = await blockDate(monday, 'Feriado');
    cleanupBlockedDates.push(blockId);

    const [day, month] = monday.split('-').slice(1).reverse().map(Number);

    await sendBotMessage(request, 'oi');
    const greeting = await getLastBotMessage();
    expect(greeting).not.toBeNull();

    await sendBotMessage(request, `quero agendar no dia ${day}/${month} às 10h`);
    const botResponse = await getLastBotMessage(greeting!);
    expect(botResponse).not.toBeNull();

    // Bot deve rejeitar — mencionar bloqueio, feriado ou indisponibilidade
    expect(botResponse!.toLowerCase()).toMatch(
      /bloqueado|feriado|indisponív|não atendo|fechado|outra data/i,
    );
    // Não deve confirmar agendamento
    expect(botResponse!.toLowerCase()).not.toMatch(/confirmado|agendado|marcado/i);
  });

  /**
   * Teste 2: Bot rejeita agendamento em período de férias (blocked_periods)
   *
   * Setup: blocked_periods cobrindo a próxima semana (segunda a sexta).
   * Cliente tenta agendar na quarta (meio das férias) → bot deve rejeitar e
   * mencionar o período de férias.
   */
  test('bot rejeita agendamento durante período de férias (blocked_periods)', async ({
    request,
  }) => {
    test.setTimeout(90_000);

    const monday = nextWeekday(1);
    // Compute wednesday and friday relative to monday (same week) to guarantee start_date < end_date
    const mondayDate = new Date(monday + 'T12:00:00');
    const wednesdayDate = new Date(mondayDate);
    wednesdayDate.setDate(wednesdayDate.getDate() + 2);
    const fridayDate = new Date(mondayDate);
    fridayDate.setDate(fridayDate.getDate() + 4);
    const wednesday = wednesdayDate.toISOString().split('T')[0];
    const friday = fridayDate.toISOString().split('T')[0];
    const periodId = await blockPeriod(monday, friday, 'Férias');
    cleanupBlockedPeriods.push(periodId);

    const [wDay, wMonth] = wednesday.split('-').slice(1).reverse().map(Number);

    await sendBotMessage(request, 'oi');
    const greeting = await getLastBotMessage();
    expect(greeting).not.toBeNull();

    await sendBotMessage(request, `quero agendar no dia ${wDay}/${wMonth} às 14h`);
    const botResponse = await getLastBotMessage(greeting!);
    expect(botResponse).not.toBeNull();

    // Bot deve rejeitar mencionando férias ou período bloqueado
    expect(botResponse!.toLowerCase()).toMatch(/férias|bloqueado|indisponív|não atendo|fechado/i);
    // Não deve confirmar agendamento
    expect(botResponse!.toLowerCase()).not.toMatch(/confirmado|agendado|marcado/i);
  });

  /**
   * Teste 3: Bot aceita agendamento ANTES do período bloqueado
   *
   * Setup: blocked_periods cobrindo terça a quinta.
   * Cliente tenta agendar na segunda (antes do bloqueio) → bot deve aceitar.
   */
  test('bot aceita agendamento antes do período bloqueado', async ({ request }) => {
    test.setTimeout(90_000);

    const monday = nextWeekday(1);
    // Calcular terça e quinta como offsets de segunda (evita inversão de datas
    // quando nextWeekday(2) retorna data posterior a nextWeekday(4))
    const mondayDate = new Date(monday + 'T12:00:00');
    const tuesdayDate = new Date(mondayDate);
    tuesdayDate.setDate(mondayDate.getDate() + 1);
    const thursdayDate = new Date(mondayDate);
    thursdayDate.setDate(mondayDate.getDate() + 3);
    const tuesday = tuesdayDate.toISOString().split('T')[0];
    const thursday = thursdayDate.toISOString().split('T')[0];
    const periodId = await blockPeriod(tuesday, thursday, 'Recesso');
    cleanupBlockedPeriods.push(periodId);

    const [mDay, mMonth] = monday.split('-').slice(1).reverse().map(Number);

    await sendBotMessage(request, 'oi');
    const greeting = await getLastBotMessage();
    expect(greeting).not.toBeNull();

    await sendBotMessage(request, `quero agendar no dia ${mDay}/${mMonth} às 10h`);
    const botResponse = await getLastBotMessage(greeting!);
    expect(botResponse).not.toBeNull();

    // Bot deve avançar o fluxo (pedir nome, confirmar, etc.) — não rejeitar
    expect(botResponse!.toLowerCase()).not.toMatch(/bloqueado|férias|recesso|indisponív/i);
  });
});
