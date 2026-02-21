/**
 * CRM de Clientes
 */
import { test, expect } from '@playwright/test';
import { TEST } from '../helpers/config';

const BASE = TEST.BASE_URL;

test.describe('Dashboard — Clientes', () => {
  test('carrega heading Clientes', async ({ page }) => {
    await page.goto(`${BASE}/clients`);
    await expect(page.getByRole('heading', { name: /clientes/i })).toBeVisible({ timeout: 15_000 });
  });

  test('abas CRM e Gerenciar presentes', async ({ page }) => {
    await page.goto(`${BASE}/clients`);
    // As abas podem ser role="tab" ou role="button" dependendo da implementação
    const crmTab = page.getByRole('tab', { name: /crm/i }).or(
      page.getByRole('button', { name: /crm/i })
    );
    const gerenciarTab = page.getByRole('tab', { name: /gerenciar/i }).or(
      page.getByRole('button', { name: /gerenciar/i })
    );
    await expect(crmTab.first()).toBeVisible({ timeout: 10_000 });
    await expect(gerenciarTab.first()).toBeVisible({ timeout: 10_000 });
  });

  test('aba CRM mostra filtros de segmentação', async ({ page }) => {
    await page.goto(`${BASE}/clients`);
    await expect(page.getByText(/aniversariantes/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('aba Gerenciar mostra botões de ação', async ({ page }) => {
    await page.goto(`${BASE}/clients`);
    // Clicar na aba Gerenciar (pode ser tab ou button)
    const gerenciarTab = page.getByRole('tab', { name: /gerenciar/i }).or(
      page.getByRole('button', { name: /gerenciar/i })
    );
    await gerenciarTab.first().click();
    // Verificar botões de ação
    await expect(
      page.getByRole('button', { name: /adicionar contato/i })
        .or(page.getByRole('button', { name: /importar csv/i }))
        .first()
    ).toBeVisible({ timeout: 10_000 });
  });
});
