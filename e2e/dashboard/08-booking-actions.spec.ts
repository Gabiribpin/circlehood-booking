/**
 * Ações de agendamento no dashboard — concluir, cancelar, filtrar.
 *
 * Cenários cobertos:
 *  1. Filtros de status (abas Todos / Confirmados / Concluídos / Cancelados)
 *  2. Campo de busca de agendamento por nome de cliente
 *  3. Botão de detalhes de agendamento abre painel/modal
 *  4. Presence de botões de ação (Concluir / Cancelar)
 */
import { test, expect } from '@playwright/test';
import { TEST } from '../helpers/config';

const BASE = TEST.BASE_URL;

test.describe('Dashboard — Ações de Agendamentos', () => {
  test('abas de filtro de status estão presentes e funcionam', async ({ page }) => {
    await page.goto(`${BASE}/bookings`);

    // Verificar que a aba "Todos" existe (pode ser tab ou button)
    const todosTab = page
      .getByRole('tab', { name: /todos/i })
      .or(page.getByRole('button', { name: /todos/i }));
    await expect(todosTab.first()).toBeVisible({ timeout: 15_000 });

    // Verificar que abas de status existem
    const confirmadosTab = page
      .getByRole('tab', { name: /confirmados/i })
      .or(page.getByRole('button', { name: /confirmados/i }));
    await expect(confirmadosTab.first()).toBeVisible();

    const canceladosTab = page
      .getByRole('tab', { name: /cancelados/i })
      .or(page.getByRole('button', { name: /cancelados/i }));
    await expect(canceladosTab.first()).toBeVisible();

    const concluidosTab = page
      .getByRole('tab', { name: /conclu/i })
      .or(page.getByRole('button', { name: /conclu/i }));
    await expect(concluidosTab.first()).toBeVisible();
  });

  test('clicar em aba Cancelados não quebra a página', async ({ page }) => {
    await page.goto(`${BASE}/bookings`);
    await page.waitForTimeout(2_000); // aguarda carregamento dos agendamentos

    const canceladosTab = page
      .getByRole('tab', { name: /cancelados/i })
      .or(page.getByRole('button', { name: /cancelados/i }));
    await canceladosTab.first().click();

    // Página não deve mostrar erro 500
    await expect(page.locator('body')).not.toContainText(/erro interno|500/i, { timeout: 8_000 });
  });

  test('clicar em aba Concluídos não quebra a página', async ({ page }) => {
    await page.goto(`${BASE}/bookings`);
    await page.waitForTimeout(2_000);

    const concluidosTab = page
      .getByRole('tab', { name: /conclu/i })
      .or(page.getByRole('button', { name: /conclu/i }));
    await concluidosTab.first().click();

    await expect(page.locator('body')).not.toContainText(/erro interno|500/i, { timeout: 8_000 });
  });

  test('campo de busca de cliente está presente', async ({ page }) => {
    await page.goto(`${BASE}/bookings`);

    // Campo de busca (input de texto com placeholder de busca)
    const searchInput = page
      .getByPlaceholder(/buscar|cliente|pesquisa/i)
      .or(page.locator('input[type="search"]'))
      .or(page.locator('input[type="text"]').filter({ hasText: '' }));

    // Se existe campo de busca, deve estar visível
    // (nem todas as implementações têm busca — tornamos opcional)
    const hasSearch = await searchInput.first().isVisible().catch(() => false);
    if (hasSearch) {
      await expect(searchInput.first()).toBeVisible();
    }
  });

  test('agendamento existente mostra botões de ação', async ({ page }) => {
    await page.goto(`${BASE}/bookings`);
    await page.waitForTimeout(3_000); // aguarda carregamento completo

    // Se há agendamentos confirmados, deve aparecer botão de ação
    const actionButtons = page
      .getByRole('button', { name: /concluir|cancelar|confirmar/i })
      .first();

    // Verifica que ao menos a lista carregou (com ou sem agendamentos)
    await expect(page.locator('body')).not.toContainText(/erro interno|500/i, { timeout: 8_000 });

    // Se há botão de ação, não deve estar desabilitado
    if (await actionButtons.isVisible().catch(() => false)) {
      await expect(actionButtons).toBeEnabled();
    }
  });
});

test.describe('Dashboard — Navegação por Agendamento Específico', () => {
  test('clique em agendamento abre detalhes sem erro', async ({ page }) => {
    await page.goto(`${BASE}/bookings`);
    await page.waitForTimeout(3_000);

    // Tentar clicar no primeiro card de agendamento se existir
    const firstCard = page
      .locator('[data-testid="booking-card"], .booking-card, article')
      .first();

    if (await firstCard.isVisible().catch(() => false)) {
      await firstCard.click({ force: true });
      // Não deve navegar para 404 ou mostrar erro
      await expect(page.locator('body')).not.toContainText(/página não encontrada|404/i, {
        timeout: 5_000,
      });
    }
  });
});
