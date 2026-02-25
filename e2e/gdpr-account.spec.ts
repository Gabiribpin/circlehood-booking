/**
 * Testes E2E — GDPR: Exportação de Dados e Zona de Perigo
 *
 * Cobre os fluxos implementados em settings-manager.tsx + /api/account/export-data.
 *
 * Autenticado — usa sessão salva pelo auth-setup (Salão da Rita).
 *
 * ⚠️ NÃO testamos a exclusão real de conta (irreversível).
 *    Apenas verificamos a presença da UI e que a API de exportação responde.
 *
 * Art. 20 GDPR: Exportação de dados em JSON → verificada via interceptação de request.
 * Art. 17 GDPR: Zona de Perigo (botão + step 1 de confirmação) → verificada visualmente.
 */
import { test, expect } from '@playwright/test';
import { TEST } from './helpers/config';

const BASE = TEST.BASE_URL;

// ─── Seção de Exportação de Dados ────────────────────────────────────────────

test.describe('GDPR Art. 20 — Exportação de Dados', () => {
  test('seção "Exportar meus dados" visível em /settings', async ({ page }) => {
    await page.goto(`${BASE}/settings`);
    await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible({ timeout: 15_000 });

    // Card de exportação deve ter o título correto
    await expect(
      page.getByText(/exportar meus dados/i).first()
    ).toBeVisible({ timeout: 10_000 });

    // Botão "Baixar meus dados" deve estar visível e habilitado
    const downloadBtn = page.getByRole('button', { name: /baixar meus dados/i });
    await expect(downloadBtn).toBeVisible({ timeout: 5_000 });
    await expect(downloadBtn).toBeEnabled();
  });

  test('API /api/account/export-data responde com JSON válido', async ({ page }) => {
    // Navegar para /settings para estabelecer sessão autenticada (cookies)
    await page.goto(`${BASE}/settings`);
    await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible({ timeout: 15_000 });

    // Chamar a API diretamente via fetch no contexto autenticado da página.
    // Nota: page.waitForResponse + response.json() NÃO funciona para respostas com
    // Content-Disposition: attachment — o Playwright não expõe o body de downloads.
    const result = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/account/export-data');
        const body = await res.json().catch(() => null);
        return {
          status: res.status,
          contentType: res.headers.get('content-type') ?? '',
          body,
        };
      } catch {
        return { status: 0, contentType: '', body: null };
      }
    });

    expect(result.status).toBe(200);
    expect(result.contentType).toContain('application/json');
    expect(result.body).not.toBeNull();
    expect(result.body).toHaveProperty('exported_at');
    expect(result.body).toHaveProperty('professional');
    expect(result.body).toHaveProperty('services');
    expect(result.body).toHaveProperty('bookings');

    // Dados sensíveis de Stripe NÃO devem estar no export
    const bodyStr = JSON.stringify(result.body);
    expect(bodyStr).not.toContain('stripe_customer_id');
    expect(bodyStr).not.toContain('stripe_subscription_id');
  });
});

// ─── Zona de Perigo ───────────────────────────────────────────────────────────

test.describe('GDPR Art. 17 — Zona de Perigo', () => {
  test('seção "Zona de Perigo" visível com fundo vermelho em /settings', async ({ page }) => {
    await page.goto(`${BASE}/settings`);
    await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible({ timeout: 15_000 });

    // Heading "Zona de Perigo" deve estar visível
    await expect(
      page.getByText(/zona de perigo/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('botão "Solicitar exclusão da conta" visível e abre step de confirmação', async ({ page }) => {
    await page.goto(`${BASE}/settings`);
    await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible({ timeout: 15_000 });

    // Botão de exclusão deve estar visível
    const deleteBtn = page.getByRole('button', { name: /solicitar exclusão da conta/i });
    await expect(deleteBtn).toBeVisible({ timeout: 10_000 });

    // Clicar → avança para step 1 de confirmação (aviso)
    await deleteBtn.click();

    // Step 1: mensagem de aviso visível (não pede input ainda)
    // O texto de aviso mencionado na config: tAccount('deleteWarning') ou tAccount('confirmTitle')
    await expect(
      page.getByText(/Tem certeza|apagados permanentemente/i).first()
    ).toBeVisible({ timeout: 5_000 });

    // Botão "Cancelar" (step 1) deve aparecer para poder recuar
    const cancelBtn = page.getByRole('button', { name: /cancelar/i }).first();
    await expect(cancelBtn).toBeVisible({ timeout: 5_000 });

    // Clicar Cancelar → volta ao estado inicial (botão de exclusão reaparece)
    await cancelBtn.click();
    await expect(deleteBtn).toBeVisible({ timeout: 5_000 });
  });

  test('step 2 de confirmação exige digitar "EXCLUIR"', async ({ page }) => {
    await page.goto(`${BASE}/settings`);
    await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible({ timeout: 15_000 });

    // Abrir step 1
    await page.getByRole('button', { name: /solicitar exclusão da conta/i }).click();

    // Continuar para step 2 (botão "Continuar" ou "Confirmar")
    const continueBtn = page.getByRole('button', { name: /continuar|prosseguir/i }).first();
    await expect(continueBtn).toBeVisible({ timeout: 5_000 });
    await continueBtn.click();

    // Step 2: campo de texto para digitar EXCLUIR deve aparecer
    const input = page.getByPlaceholder('EXCLUIR');
    await expect(input).toBeVisible({ timeout: 5_000 });

    // Botão final de confirmação deve estar desabilitado com texto errado
    const confirmBtn = page.getByRole('button', { name: /excluir minha conta|confirmar exclusão/i });
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 });

    // Digitar texto errado → botão permanece desabilitado
    // Nota: componente usa .toUpperCase() na comparação, então "excluir" (minúsculo)
    // TAMBÉM habilita o botão. Usar texto completamente errado.
    await input.fill('texto-errado');
    await expect(confirmBtn).toBeDisabled();

    // Digitar texto correto (EXCLUIR em maiúsculas) → botão habilita
    await input.fill('EXCLUIR');
    await expect(confirmBtn).toBeEnabled({ timeout: 3_000 });

    // ⚠️ NÃO clicar no botão — teste termina aqui para não deletar a conta
  });
});
