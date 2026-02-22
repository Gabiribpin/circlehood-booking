/**
 * Testes de Idempotência — Garantir que agendamentos não são duplicados
 *
 * Cenários cobertos:
 *  1. Duplo-clique no botão confirmar → apenas 1 agendamento no DB
 *  2. Reload da página após sucesso → não cria duplicado
 *  3. Navegação back/forward → não cria duplicado
 *  4. 5 requisições simultâneas via API → apenas 1 agendamento no DB
 *
 * Phone dedicado: 353800000099 (não interfere em outros testes)
 */
import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { TEST } from '../helpers/config';
import { nextWeekday } from '../helpers/setup';

const BASE = TEST.BASE_URL;
const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);

const TEST_PHONE_IDEM = '353800000099'; // dedicado — não interfere em outros testes
const BOOKING_SLUG = 'salao-da-rita';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function cleanIdempotencyBookings() {
  await supabase
    .from('bookings')
    .update({
      status: 'cancelled',
      cancelled_by: 'system',
      cancellation_reason: 'Idempotency E2E cleanup',
    })
    .eq('professional_id', TEST.PROFESSIONAL_ID)
    .eq('client_phone', TEST_PHONE_IDEM)
    .neq('status', 'cancelled');
}

async function countActiveIdempotencyBookings(): Promise<number> {
  const { count } = await supabase
    .from('bookings')
    .select('id', { count: 'exact' })
    .eq('professional_id', TEST.PROFESSIONAL_ID)
    .eq('client_phone', TEST_PHONE_IDEM)
    .neq('status', 'cancelled');
  return count ?? 0;
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
  return data ?? null;
}

async function getFirstAvailableSlot(
  request: APIRequestContext,
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

/**
 * Navega pelo formulário de agendamento (steps 1-4) via UI.
 * Para em step 4, antes de clicar em confirmar.
 *
 * Usa terça-feira (dia 2) como data-alvo para isolar dos outros testes
 * que usam quinta (4) e sexta (5).
 *
 * Retorna { slot, date } ou null se não houver slots disponíveis.
 */
async function fillBookingFormToStep4(
  page: Page,
  request: APIRequestContext,
): Promise<{ slot: string; date: string } | null> {
  // Usa terça como dia dos testes de idempotência
  const targetDate = nextWeekday(2);
  const service = await getFirstActiveService();
  if (!service) return null;

  const firstSlot = await getFirstAvailableSlot(request, service.id, targetDate);
  if (!firstSlot) return null;

  // Step 1: Navegar para a página pública e clicar no primeiro serviço
  await page.goto(`${BASE}/${BOOKING_SLUG}`, { waitUntil: 'networkidle' });
  await page.locator('section h2:has-text("Agendar") ~ div .cursor-pointer, section >> .cursor-pointer').first().click();

  // Step 2: Selecionar a data no calendário
  // O CalendarDayButton tem data-day=[locale date]. Usamos o número do dia
  // para encontrar o botão correto, navegando o mês se necessário.
  await page.waitForSelector('[data-slot="calendar"]', { timeout: 10_000 });

  const dayNum = new Date(targetDate + 'T12:00:00').getDate();

  // Pode precisar navegar para o mês correto (ex: se hoje é último dia do mês)
  let dayClicked = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const dayButton = page
      .locator('button[data-day]:not([disabled])')
      .filter({ hasText: new RegExp(`^${dayNum}$`) })
      .first();

    if ((await dayButton.count()) > 0) {
      await dayButton.click();
      dayClicked = true;
      break;
    }

    // Avançar mês se o dia não foi encontrado no mês atual
    const nextMonthBtn = page.locator('[data-slot="calendar"] .rdp-button_next').first();
    if ((await nextMonthBtn.count()) > 0) {
      await nextMonthBtn.click();
      await page.waitForTimeout(300);
    } else {
      break;
    }
  }

  if (!dayClicked) return null;

  // Step 3: Selecionar o horário (primeiro disponível)
  // TimeSlots carrega via fetch — aguardar Loader2 desaparecer
  await page.waitForFunction(
    () => !document.querySelector('.animate-spin'),
    { timeout: 10_000 },
  );

  // Botões de slot têm texto no formato HH:MM
  const slotButton = page
    .locator('button')
    .filter({ hasText: new RegExp(`^${firstSlot}$`) })
    .first();

  if ((await slotButton.count()) === 0) return null;
  await slotButton.click();

  // Step 4: Preencher dados do cliente
  await page.waitForSelector('#clientName', { timeout: 10_000 });
  await page.locator('#clientName').fill('Cliente Idempotência');
  await page.locator('#clientPhone').fill(TEST_PHONE_IDEM);

  // Aguardar botão confirmar ficar habilitado
  await page
    .locator('button:has-text("Confirmar agendamento")')
    .waitFor({ state: 'visible', timeout: 5_000 });

  return { slot: firstSlot, date: targetDate };
}

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

test.beforeEach(async () => {
  await cleanIdempotencyBookings();
});

test.afterEach(async () => {
  await cleanIdempotencyBookings();
});

// ─── Testes ───────────────────────────────────────────────────────────────────

test.describe('Idempotência — Não duplicar agendamentos', () => {
  /**
   * Teste 1: Duplo-clique no botão "Confirmar agendamento"
   *
   * O botão tem disabled={submitting} → desabilita no primeiro clique.
   * Verifica que apenas 1 agendamento é criado, mesmo com cliques rápidos.
   */
  test('duplo-clique no confirmar → apenas 1 agendamento criado', async ({ page, request }) => {
    const result = await fillBookingFormToStep4(page, request);
    if (!result) test.skip(true, 'Sem slots disponíveis na terça');

    let apiCallCount = 0;

    // Interceptar POST /api/bookings para contar chamadas
    // (sem alterar a resposta — deixa passar normalmente)
    await page.route('**/api/bookings', async (route) => {
      apiCallCount++;
      await route.continue();
    });

    const confirmBtn = page.locator('button:has-text("Confirmar agendamento")');

    // Dois cliques rápidos — o segundo deve ser no-op porque disabled=true após o primeiro
    // force:true ignora actionability checks (elemento pode estar disabled)
    // mas o browser/React descarta o evento em botão disabled — só 1 POST é feito
    await confirmBtn.click();
    await confirmBtn.click({ force: true });

    // Aguardar sucesso
    await expect(page.locator('text=Agendamento confirmado')).toBeVisible({ timeout: 15_000 });

    // Apenas 1 chamada à API deve ter sido feita
    expect(apiCallCount).toBe(1);

    // Apenas 1 agendamento no banco
    const count = await countActiveIdempotencyBookings();
    expect(count).toBe(1);
  });

  /**
   * Teste 2: Reload da página após sucesso
   *
   * Após booking bem-sucedido (step 5), recarregar a página reseta o estado
   * React para step 1 — não deve criar um segundo agendamento.
   */
  test('reload após sucesso → não cria duplicado', async ({ page, request }) => {
    const result = await fillBookingFormToStep4(page, request);
    if (!result) test.skip(true, 'Sem slots disponíveis na terça');

    // Confirmar agendamento
    await page.locator('button:has-text("Confirmar agendamento")').click();
    await expect(page.locator('text=Agendamento confirmado')).toBeVisible({ timeout: 15_000 });

    // 1 agendamento após o sucesso
    expect(await countActiveIdempotencyBookings()).toBe(1);

    // Recarregar a página
    await page.reload({ waitUntil: 'networkidle' });

    // Formulário volta ao step 1 (sem agendamento automático)
    await expect(page.locator('text=Agendar')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Agendamento confirmado')).not.toBeVisible();

    // Ainda apenas 1 agendamento no banco (reload não cria novo)
    const count = await countActiveIdempotencyBookings();
    expect(count).toBe(1);
  });

  /**
   * Teste 3: Navegação back → forward após sucesso
   *
   * Após booking bem-sucedido, pressionar voltar e avançar não deve
   * re-submeter o formulário (estado React não persiste na history).
   */
  test('back/forward após sucesso → não cria duplicado', async ({ page, request }) => {
    // Garantir que há uma página anterior na history para o back funcionar
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' }).catch(() => {
      // homepage pode não existir — ok, só precisamos de algo na history
    });

    const result = await fillBookingFormToStep4(page, request);
    if (!result) test.skip(true, 'Sem slots disponíveis na terça');

    // Confirmar agendamento
    await page.locator('button:has-text("Confirmar agendamento")').click();
    await expect(page.locator('text=Agendamento confirmado')).toBeVisible({ timeout: 15_000 });

    expect(await countActiveIdempotencyBookings()).toBe(1);

    // Navegar para trás (sai da página de booking)
    await page.goBack({ waitUntil: 'networkidle' }).catch(() => {
      // Se não há página anterior, não faz nada (teste ainda válido)
    });

    // Navegar para frente (volta para a página de booking)
    await page.goForward({ waitUntil: 'networkidle' }).catch(() => {});

    // Aguardar um pouco para qualquer re-submissão acidental
    await page.waitForTimeout(2_000);

    // Ainda apenas 1 agendamento (back/forward não re-submete)
    const count = await countActiveIdempotencyBookings();
    expect(count).toBe(1);
  });

  /**
   * Teste 4: 5 requisições simultâneas via API
   *
   * Dispara 5 POST idênticos para /api/bookings ao mesmo tempo.
   * Apesar de possível race condition no check-then-insert, apenas
   * 1 agendamento deve existir no banco ao final.
   *
   * Se este teste falhar com count > 1, significa que o backend precisa
   * de proteção adicional (ex: unique constraint DB ou idempotency key).
   */
  test('5 requisições simultâneas → apenas 1 agendamento no DB', async ({ request }) => {
    const service = await getFirstActiveService();
    if (!service) test.skip(true, 'Sem serviços ativos');

    // Usar quarta-feira para este teste de API (isolado do teste UI acima que usa terça)
    const wednesday = nextWeekday(3);
    const firstSlot = await getFirstAvailableSlot(request, service!.id, wednesday);
    if (!firstSlot) test.skip(true, 'Sem slots disponíveis na quarta');

    const bookingData = {
      professional_id: TEST.PROFESSIONAL_ID,
      service_id: service!.id,
      booking_date: wednesday,
      start_time: firstSlot,
      client_name: 'Cliente Concurrent E2E',
      client_phone: TEST_PHONE_IDEM,
      client_email: 'concurrent-e2e@circlehood.io',
    };

    // Disparar 5 requisições simultâneas
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request.post(`${BASE}/api/bookings`, { data: bookingData }),
      ),
    );

    const statuses = await Promise.all(responses.map((r) => r.status()));
    const successCount = statuses.filter((s) => s === 201).length;
    const conflictCount = statuses.filter((s) => s === 409).length;

    // Pelo menos 1 deve ter sucedido
    expect(successCount).toBeGreaterThanOrEqual(1);

    // Total de 201 + 409 deve ser 5 (sem outros erros)
    expect(successCount + conflictCount).toBe(5);

    // Crítico: apenas 1 agendamento no banco — mesmo com race condition
    const dbCount = await countActiveIdempotencyBookings();
    expect(dbCount).toBe(1);
  });
});
