/**
 * Testes de API — Bloqueio de Período / Férias
 *
 * Valida que /api/available-slots respeita:
 *  - blocked_dates (dia único)
 *  - blocked_periods (range de datas — férias, feriados prolongados)
 *
 * Sem Claude. CI habilitado.
 *
 * Execução local:
 *   npx playwright test --project=blocked-periods-api
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { TEST } from '../helpers/config';

/**
 * Retorna a próxima ocorrência de um dia da semana com pelo menos 28 dias de antecedência.
 * Evita interferência com outros jobs que usam farFutureWeekday() (~7 dias).
 */
function farFutureWeekday(dayOfWeek: number): string {
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 28);
  let daysAhead = dayOfWeek - minDate.getDay();
  if (daysAhead < 0) daysAhead += 7;
  minDate.setDate(minDate.getDate() + daysAhead);
  return minDate.toISOString().split('T')[0];
}

const BASE = TEST.BASE_URL;
const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);

// IDs de bloqueios criados durante os testes (para cleanup)
const cleanupBlockedDates: string[] = [];
const cleanupBlockedPeriods: string[] = [];

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

test.afterEach(async () => {
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

test.describe('API — Bloqueio de Data Única (blocked_dates)', () => {
  /**
   * Teste 1: Dia bloqueado → API retorna slots vazios
   *
   * blocked_dates é a funcionalidade existente (feriados, folgas únicas).
   * Confirma que a API respeita esse bloqueio e retorna array vazio.
   */
  test('dia bloqueado → /available-slots retorna vazio', async ({ request }) => {
    const service = await getFirstActiveService();
    if (!service) test.skip(true, 'Sem serviços ativos');

    // Verificar que a segunda normalmente tem slots
    const monday = farFutureWeekday(1);
    const slotsBefore = await getAvailableSlots(request, service!.id, monday);
    if (slotsBefore.length === 0) test.skip(true, 'Segunda não tem slots (dia de folga?)');

    // Bloquear a segunda
    const blockId = await blockDate(monday, 'Feriado E2E');
    cleanupBlockedDates.push(blockId);

    // API deve retornar vazio
    const slotsAfter = await getAvailableSlots(request, service!.id, monday);
    expect(slotsAfter).toHaveLength(0);
  });

  /**
   * Teste 2: Após remover bloqueio → slots voltam a aparecer
   *
   * Garante que o bloqueio não é permanente — ao remover, a data fica disponível.
   */
  test('remover bloqueio de data → slots voltam a aparecer', async ({ request }) => {
    const service = await getFirstActiveService();
    if (!service) test.skip(true, 'Sem serviços ativos');

    const tuesday = farFutureWeekday(2);
    const slotsBefore = await getAvailableSlots(request, service!.id, tuesday);
    if (slotsBefore.length === 0) test.skip(true, 'Terça não tem slots');

    // Bloquear
    const blockId = await blockDate(tuesday, 'Feriado temporário E2E');

    // Confirmar bloqueio
    const slotsBlocked = await getAvailableSlots(request, service!.id, tuesday);
    expect(slotsBlocked).toHaveLength(0);

    // Remover bloqueio
    await supabase.from('blocked_dates').delete().eq('id', blockId);

    // Slots devem voltar
    const slotsAfterRemoval = await getAvailableSlots(request, service!.id, tuesday);
    expect(slotsAfterRemoval.length).toBeGreaterThan(0);
  });
});

test.describe('API — Bloqueio de Período (blocked_periods)', () => {
  /**
   * Teste 3: Data dentro de período bloqueado → API retorna vazio
   *
   * blocked_periods suporta ranges (férias). Qualquer data dentro do intervalo
   * [start_date, end_date] deve retornar slots vazios.
   */
  test('data dentro do período bloqueado → /available-slots retorna vazio', async ({
    request,
  }) => {
    const service = await getFirstActiveService();
    if (!service) test.skip(true, 'Sem serviços ativos');

    const monday = farFutureWeekday(1);
    const wednesday = farFutureWeekday(3);
    const friday = farFutureWeekday(5);

    // Verificar que quarta normalmente tem slots
    const slotsBeforeBlock = await getAvailableSlots(request, service!.id, wednesday);
    if (slotsBeforeBlock.length === 0) test.skip(true, 'Quarta não tem slots');

    // Bloquear período: segunda até sexta (semana de férias)
    const periodId = await blockPeriod(monday, friday, 'Férias E2E');
    cleanupBlockedPeriods.push(periodId);

    // Quarta está dentro do período — deve retornar vazio
    const slotsWed = await getAvailableSlots(request, service!.id, wednesday);
    expect(slotsWed).toHaveLength(0);

    // Segunda e sexta (extremos do intervalo) também devem estar bloqueadas
    const slotsMon = await getAvailableSlots(request, service!.id, monday);
    expect(slotsMon).toHaveLength(0);

    const slotsFri = await getAvailableSlots(request, service!.id, friday);
    expect(slotsFri).toHaveLength(0);
  });

  /**
   * Teste 4: Datas fora do período bloqueado → slots disponíveis normalmente
   *
   * O bloqueio não deve afetar datas anteriores ou posteriores ao período.
   */
  test('datas fora do período bloqueado → slots disponíveis normalmente', async ({ request }) => {
    const service = await getFirstActiveService();
    if (!service) test.skip(true, 'Sem serviços ativos');

    // Bloquear apenas a próxima terça
    const tuesday = farFutureWeekday(2);
    const periodId = await blockPeriod(tuesday, tuesday, 'Folga E2E');
    cleanupBlockedPeriods.push(periodId);

    // Segunda (antes do bloqueio) deve ter slots
    const monday = farFutureWeekday(1);
    const slotsMon = await getAvailableSlots(request, service!.id, monday);
    // Só verifica se segunda é dia de trabalho
    if (slotsMon.length === 0) {
      // Segunda pode ser folga — verificar quarta (depois do bloqueio)
    }

    // Quarta (depois do bloqueio) deve ter slots
    const wednesday = farFutureWeekday(3);
    const slotsWed = await getAvailableSlots(request, service!.id, wednesday);

    // Pelo menos segunda ou quarta deve ter slots disponíveis
    const atLeastOneAvailable = slotsMon.length > 0 || slotsWed.length > 0;
    expect(atLeastOneAvailable).toBe(true);

    // Terça (bloqueada) deve estar vazia
    const slotsTue = await getAvailableSlots(request, service!.id, tuesday);
    expect(slotsTue).toHaveLength(0);
  });

  /**
   * Teste 5: Após remover período bloqueado → datas voltam a ter slots
   */
  test('remover período bloqueado → datas voltam a ter slots', async ({ request }) => {
    const service = await getFirstActiveService();
    if (!service) test.skip(true, 'Sem serviços ativos');

    const monday = farFutureWeekday(1);
    const wednesday = farFutureWeekday(3);
    const slotsBefore = await getAvailableSlots(request, service!.id, monday);
    if (slotsBefore.length === 0) test.skip(true, 'Segunda não tem slots');

    // Bloquear período segunda → quarta
    const periodId = await blockPeriod(monday, wednesday, 'Recesso E2E temporário');

    // Confirmar bloqueio
    const slotsBlocked = await getAvailableSlots(request, service!.id, monday);
    expect(slotsBlocked).toHaveLength(0);

    // Remover período
    await supabase.from('blocked_periods').delete().eq('id', periodId);

    // Slots devem voltar para a segunda
    const slotsAfterRemoval = await getAvailableSlots(request, service!.id, monday);
    expect(slotsAfterRemoval.length).toBeGreaterThan(0);
  });
});
