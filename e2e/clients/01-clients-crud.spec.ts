/**
 * E2E: Clientes — CRUD + filtros + toggle Bot
 *
 * Testa a aba "Gerenciar" em /clients?tab=manage:
 *  1. Lista carrega e exibe a aba Gerenciar
 *  2. Adicionar contato → aparece na lista
 *  3. Editar contato → alteração persistiu
 *  4. Buscar contato → filtro funciona
 *  5. Filtrar por Bot Ativo / Bot Desativado
 *  6. Toggle Bot → atualiza imediatamente (sem reload)
 *  7. Excluir contato → sumiu da lista
 *
 * Cleanup: afterAll remove via Supabase service role todos os contatos criados.
 *
 * Usa storageState do auth-setup. Requer auth.
 */

import { createClient } from '@supabase/supabase-js';
import { test, expect } from '@playwright/test';
import { TEST } from '../helpers/config';

const BASE = TEST.BASE_URL;

// Contato único para este run (evita colisão com outros runs)
const UNIQUE_SUFFIX = Date.now().toString().slice(-6);
const CONTACT_NAME = `E2E Cliente ${UNIQUE_SUFFIX}`;
const CONTACT_NAME_EDITED = `E2E Cliente ${UNIQUE_SUFFIX} (editado)`;
const CONTACT_PHONE = `+3530000${UNIQUE_SUFFIX}`;
const CONTACT_EMAIL = `e2e${UNIQUE_SUFFIX}@teste.local`;

const createdIds: string[] = [];

async function cleanup() {
  if (!TEST.SUPABASE_URL || !TEST.SUPABASE_SERVICE_KEY || createdIds.length === 0) return;
  const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);
  await supabase.from('contacts').delete().in('id', createdIds);
}

/** Navega para /clients?tab=manage e aguarda a aba estar activa. */
async function gotoManage(page: import('@playwright/test').Page) {
  await page.goto(`${BASE}/clients?tab=manage`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1').first()).toContainText('👥', { timeout: 20_000 });
  // Aguardar o tab manage estar seleccionado
  await expect(page.getByRole('tab', { selected: true })).toContainText(/Gerenciar|Manage|Gestionar/, {
    timeout: 15_000,
  });
}

test.describe('Clientes — CRUD + Filtros', () => {
  test.afterAll(async () => {
    await cleanup();
  });

  // ── 1. Lista carrega ─────────────────────────────────────────────────────

  test('1. Aba Gerenciar carrega com lista de contatos', async ({ page }) => {
    await gotoManage(page);
    // Botão de adicionar contato deve estar visível
    await expect(page.getByRole('button', { name: /Adicionar Contato|Add Contact|Agregar/i })).toBeVisible({
      timeout: 15_000,
    });
  });

  // ── 2. Adicionar contato ─────────────────────────────────────────────────

  test('2. Adicionar contato → aparece na lista', async ({ page }) => {
    await gotoManage(page);

    // Abrir dialog
    await page.getByRole('button', { name: /Adicionar Contato|Add Contact|Agregar/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });

    // Preencher nome
    await page.locator('#c-name').fill(CONTACT_NAME);

    // Preencher telefone (PhoneInput — input dentro do componente)
    const phoneInput = page.locator('[data-testid="phone-input"] input, input[type="tel"], .PhoneInputInput').first();
    await phoneInput.fill('0000' + UNIQUE_SUFFIX);

    // Preencher email
    await page.locator('#c-email').fill(CONTACT_EMAIL);

    // Salvar
    await page.getByRole('dialog').getByRole('button', { name: /Adicionar|Add|Agregar/i }).click();

    // Dialog deve fechar
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

    // Contato deve aparecer na tabela
    await expect(page.getByRole('cell', { name: CONTACT_NAME })).toBeVisible({ timeout: 15_000 });

    // Guardar ID para cleanup
    if (TEST.SUPABASE_URL && TEST.SUPABASE_SERVICE_KEY) {
      const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);
      const { data } = await supabase
        .from('contacts')
        .select('id')
        .eq('name', CONTACT_NAME)
        .eq('professional_id', TEST.PROFESSIONAL_ID)
        .single();
      if (data?.id) createdIds.push(data.id);
    }
  });

  // ── 3. Editar contato ─────────────────────────────────────────────────────

  test('3. Editar contato → alteração persiste na lista', async ({ page }) => {
    await gotoManage(page);

    // Localizar a linha do contato e clicar no botão de edição
    const row = page.getByRole('row', { name: new RegExp(CONTACT_NAME) });
    await row.waitFor({ state: 'visible', timeout: 15_000 });
    await row.getByRole('button').first().click(); // botão Editar (lápis)

    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('dialog').locator('h2, [data-slot="dialog-title"]')).toContainText(
      /Editar|Edit|Editar/i,
      { timeout: 5_000 }
    );

    // Alterar nome
    await page.locator('#c-name').clear();
    await page.locator('#c-name').fill(CONTACT_NAME_EDITED);

    // Salvar
    await page.getByRole('dialog').getByRole('button', { name: /Atualizar|Update|Actualizar/i }).click();

    // Dialog fecha
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10_000 });

    // Nome editado aparece na tabela
    await expect(page.getByRole('cell', { name: CONTACT_NAME_EDITED })).toBeVisible({
      timeout: 15_000,
    });

    // Nome antigo não aparece mais
    await expect(
      page.getByRole('cell', { name: new RegExp(`^${CONTACT_NAME}$`) })
    ).not.toBeVisible();
  });

  // ── 4. Buscar contato ─────────────────────────────────────────────────────

  test('4. Buscar contato → filtra resultados', async ({ page }) => {
    await gotoManage(page);

    // Usar campo de busca (input com ícone de lupa)
    const searchInput = page.locator('input.pl-8, input[class*="pl-8"]').first();
    await searchInput.waitFor({ state: 'visible', timeout: 15_000 });

    // Buscar pelo nome editado
    await searchInput.fill(CONTACT_NAME_EDITED.slice(0, 8));

    // Deve aparecer o contato editado
    await expect(page.getByRole('cell', { name: new RegExp(CONTACT_NAME_EDITED) })).toBeVisible({
      timeout: 10_000,
    });

    // Limpar busca — todos os contatos voltam
    await searchInput.fill('');
  });

  // ── 5. Filtrar por Bot Ativo / Bot Desativado ──────────────────────────────

  test('5. Filtrar por Bot Ativo e Bot Desativado', async ({ page }) => {
    await gotoManage(page);

    // Clicar em "🤖 Bot Ativo"
    await page.getByRole('button', { name: /Bot Ativo|Bot On|Bot Activo/i }).click();
    // Lista não deve mostrar erro; pode estar vazia ou com contatos
    await expect(page.locator('table, [class*="text-center"]')).toBeVisible({ timeout: 10_000 });

    // Clicar em "🚫 Bot Desativado"
    await page.getByRole('button', { name: /Bot Desativado|Bot Off|Bot Inactivo/i }).click();
    await expect(page.locator('table, [class*="text-center"]')).toBeVisible({ timeout: 10_000 });

    // Voltar a "Todos"
    await page.getByRole('button', { name: /^Todos$|^All$|^Todos$/i }).first().click();
  });

  // ── 6. Toggle Bot do contato ──────────────────────────────────────────────

  test('6. Toggle Bot do contato → atualiza imediatamente', async ({ page }) => {
    await gotoManage(page);

    // Localizar a linha do contato editado
    const row = page.getByRole('row', { name: new RegExp(CONTACT_NAME_EDITED) });
    await row.waitFor({ state: 'visible', timeout: 15_000 });

    // Estado actual do bot switch na linha
    const botSwitch = row.getByRole('switch');
    const wasChecked = (await botSwitch.getAttribute('aria-checked')) === 'true';

    // Toggle
    await botSwitch.click();
    // Novo estado deve ser oposto
    const expectedState = wasChecked ? 'false' : 'true';
    await expect(botSwitch).toHaveAttribute('aria-checked', expectedState, { timeout: 10_000 });

    // Restaurar estado original
    await botSwitch.click();
    await expect(botSwitch).toHaveAttribute('aria-checked', wasChecked ? 'true' : 'false', {
      timeout: 10_000,
    });
  });

  // ── 7. Excluir contato ────────────────────────────────────────────────────

  test('7. Excluir contato → sumiu da lista', async ({ page }) => {
    await gotoManage(page);

    // Localizar a linha do contato editado
    const row = page.getByRole('row', { name: new RegExp(CONTACT_NAME_EDITED) });
    await row.waitFor({ state: 'visible', timeout: 15_000 });

    // Clicar no botão de excluir (lixeira — segundo botão na linha)
    await row.getByRole('button').nth(1).click();

    // Sem dialog de confirmação — exclusão imediata
    // A linha deve desaparecer
    await expect(
      page.getByRole('cell', { name: new RegExp(CONTACT_NAME_EDITED) })
    ).not.toBeVisible({ timeout: 15_000 });
  });
});
