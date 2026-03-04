/**
 * Testes E2E — Importação de Contatos via WhatsApp
 *
 * Cobre a página /clients/import e o botão de importação do WhatsApp
 * implementado em src/app/[locale]/(dashboard)/clients/import/page.tsx.
 *
 * Autenticado — usa sessão salva pelo auth-setup (Salão da Rita).
 *
 * O botão "Importar do WhatsApp" só aparece quando o profissional tem
 * Evolution API configurada (provider = 'evolution' + is_active = true).
 * O teste consulta o banco para verificar o estado esperado e asserta de forma
 * determinística — não usa condicionais "se aparecer, então…".
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { TEST } from './helpers/config';

const BASE = TEST.BASE_URL;

// ─── Estrutura da página ──────────────────────────────────────────────────────

test.describe('Importação de Contatos — Estrutura', () => {
  test('carrega /clients/import com heading correto', async ({ page }) => {
    await page.goto(`${BASE}/clients/import`);
    await expect(
      page.getByRole('heading', { name: /importar contatos|import/i }).first()
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('body')).not.toContainText(/500|erro interno/i);
  });

  test('área de upload CSV visível', async ({ page }) => {
    await page.goto(`${BASE}/clients/import`);
    await expect(page.getByRole('heading', { name: /importar contatos/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Card de instruções ("Como preparar seu arquivo" / "Selecionar arquivo")
    await expect(page.getByText(/como preparar|selecionar arquivo/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('botão "Baixar template" ou área de drag & drop presente', async ({ page }) => {
    await page.goto(`${BASE}/clients/import`);
    await expect(page.getByRole('heading', { name: /importar contatos/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Qualquer um dos dois deve estar visível: botão de download de template OU área de drop
    const templateBtn = page.getByRole('link', { name: /baixar template|download template/i });
    const dropArea = page.locator('[class*="border-dashed"]');

    const haTemplate = await templateBtn.isVisible().catch(() => false);
    const hasDropArea = await dropArea.first().isVisible().catch(() => false);

    expect(haTemplate || hasDropArea).toBe(true);
  });
});

// ─── Botão WhatsApp — condicional por configuração ────────────────────────────

test.describe('Botão "Importar do WhatsApp"', () => {
  test('botão aparece OU não aparece conforme config Evolution da conta de teste', async ({ page }) => {
    // Consulta direta ao banco para saber o estado esperado
    // A página usa professional_id (não user_id) e verifica apenas provider === 'evolution'
    const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);
    const { data: wConfig } = await supabase
      .from('whatsapp_config')
      .select('provider')
      .eq('professional_id', TEST.PROFESSIONAL_ID)
      .maybeSingle();

    const expectEvolution = wConfig?.provider === 'evolution';

    await page.goto(`${BASE}/clients/import`);
    await expect(page.getByRole('heading', { name: /importar contatos/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Aguardar que o useEffect termine de buscar a config (pode demorar até 3s)
    // Wait for useEffect init to complete (fetches professional + whatsapp_config + contacts)
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    const whatsappBtn = page.getByRole('button', { name: /importar do whatsapp/i });

    if (expectEvolution) {
      // Evolution ativa → botão deve aparecer com estilo verde
      await expect(whatsappBtn).toBeVisible({ timeout: 5_000 });
      const cls = await whatsappBtn.getAttribute('class') ?? '';
      expect(cls).toMatch(/green/i);
      console.log('✅ Evolution configurada — botão "Importar do WhatsApp" visível');
    } else {
      // Evolution não configurada (ou Meta, ou inativo) → botão NÃO deve aparecer
      await expect(whatsappBtn).not.toBeVisible({ timeout: 5_000 });
      console.log('✅ Evolution não configurada — botão "Importar do WhatsApp" oculto');
    }
  });

  test('sem Evolution: botão "Importar do WhatsApp" não existe na página', async ({ page }) => {
    const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);
    const { data: wConfig } = await supabase
      .from('whatsapp_config')
      .select('provider')
      .eq('professional_id', TEST.PROFESSIONAL_ID)
      .maybeSingle();

    // Pular este teste se Evolution estiver configurada (coberto pelo teste anterior)
    if (wConfig?.provider === 'evolution') {
      test.skip(true, 'Evolution configurada — este teste só roda sem Evolution');
      return;
    }

    await page.goto(`${BASE}/clients/import`);
    await expect(page.getByRole('heading', { name: /importar contatos/i }).first()).toBeVisible({
      timeout: 15_000,
    });
    // Wait for useEffect init to complete (fetches professional + whatsapp_config + contacts)
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // Botão NÃO deve existir na página
    const count = await page.getByRole('button', { name: /importar do whatsapp/i }).count();
    expect(count).toBe(0);
  });
});

// ─── Navegação de volta ───────────────────────────────────────────────────────

test.describe('Navegação em /clients/import', () => {
  test('botão Voltar navega para /clients', async ({ page }) => {
    await page.goto(`${BASE}/clients/import`);
    await expect(page.getByRole('heading', { name: /importar contatos/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    // Botão "← Voltar" (ou similar) deve estar presente
    const backBtn = page.getByRole('button', { name: /voltar|back/i }).first();
    await expect(backBtn).toBeVisible({ timeout: 5_000 });

    // Clicar → navega para /clients
    await backBtn.click();
    await expect(page).toHaveURL(/\/clients/, { timeout: 10_000 });
  });
});
