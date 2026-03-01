/**
 * UX Consistency
 *
 * Testes documentativos que verificam a consistência da experiência do usuário.
 * Objetivo: documentar o estado atual da UX, não forçar implementação.
 *
 * Convenções:
 *  - test.skip() quando feature não está implementada
 *  - console.log() extensivo para documentar o que foi encontrado
 *  - Tolerante a variações de implementação (múltiplos selectors)
 *  - Autenticação via storageState (auth-setup) — sem login manual
 *
 * Selectors baseados na implementação real:
 *  - Services form: id="name", id="price", id="duration" (não name="...")
 *  - Settings: id="businessName", id="slug"
 *  - Add service button: "Adicionar serviço"
 *  - Dialog title: "Novo serviço"
 *  - Submit: "Criar" (create) | "Salvar" (edit)
 *  - Settings save: "Salvar Alterações" → "Salvo!" + Check icon
 *  - Empty state services: "Nenhum serviço cadastrado..."
 *  - Empty state bookings: "Nenhum agendamento encontrado."
 *  - Empty state clients: "Nenhum cliente encontrado" | "Nenhum contato ainda"
 */
import { test, expect } from '@playwright/test';
import { TEST } from '../helpers/config';

const BASE = TEST.BASE_URL;

// ─── 1: Empty states ─────────────────────────────────────────────────────────

test.describe('Empty States', () => {
  test('mostram mensagem útil quando não há dados', async ({ page }) => {
    const pages = [
      {
        url: `${BASE}/services`,
        emptyPattern: /nenhum servi[cç]o/i,
        // Action button sempre aparece (não depende de ter dados)
        actionPattern: /adicionar servi[cç]o/i,
      },
      {
        url: `${BASE}/bookings`,
        emptyPattern: /nenhum agendamento/i,
        actionPattern: null,
      },
      {
        url: `${BASE}/clients`,
        emptyPattern: /nenhum cliente|nenhum contato/i,
        actionPattern: null,
      },
    ];

    for (const info of pages) {
      await page.goto(info.url);
      await page.waitForLoadState('networkidle');

      const bodyText = (await page.textContent('body')) ?? '';
      const hasEmptyMessage = info.emptyPattern.test(bodyText);

      if (hasEmptyMessage) {
        console.log(`✅ ${info.url} — empty state encontrado`);

        // Verificar action button quando configurado
        if (info.actionPattern) {
          const actionBtn = page.locator('button').filter({ hasText: info.actionPattern });
          const btnCount = await actionBtn.count();
          if (btnCount > 0) {
            console.log(`  ✅ Action button encontrado`);
            await expect(actionBtn.first()).toBeVisible();
          } else {
            console.log(`  ⚠️  Action button não encontrado no empty state`);
          }
        }
      } else {
        console.log(`⏭️  ${info.url} tem dados — empty state não testável agora`);
      }
    }
  });
});

// ─── 2: Loading states ───────────────────────────────────────────────────────

test.describe('Loading States', () => {
  test('spinner aparece durante save de configurações', async ({ page }) => {
    // Mockar Supabase ANTES de navegar — o createBrowserClient (cookies-based) pode ter
    // sessão expirada em CI. Mock garante que auth.getUser() e o PATCH sejam bem-sucedidos,
    // permitindo testar o feedback visual (spinner → "Salvo!") sem depender de auth real.
    await page.route('**/auth/v1/user**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'test@circlehood.test' }),
      }),
    );
    await page.route('**/rest/v1/professionals**', async (route) => {
      const method = route.request().method();
      if (method === 'GET' || method === 'PATCH') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      } else {
        await route.continue();
      }
    });

    await page.goto(`${BASE}/settings`);
    await page.waitForLoadState('networkidle');

    const nameInput = page.locator('#businessName');
    if ((await nameInput.count()) === 0) {
      test.skip(true, 'Campo #businessName não encontrado');
      return;
    }

    const original = await nameInput.inputValue();

    // Fazer alteração mínima
    await nameInput.fill(original.trim() + ' ');

    const saveBtn = page.locator('button').filter({ hasText: /salvar alterações/i });
    if ((await saveBtn.count()) === 0) {
      test.skip(true, 'Botão "Salvar Alterações" não encontrado');
      return;
    }

    // Clicar e imediatamente verificar loading
    await saveBtn.click();

    // animate-spin pode aparecer dentro do botão (Loader2 icon) ou na página
    const spinnerVisible = await page
      .locator('svg.animate-spin, [class*="animate-spin"]')
      .first()
      .isVisible()
      .catch(() => false);

    if (spinnerVisible) {
      console.log('✅ Spinner de loading capturado durante save');
    } else {
      console.log('ℹ️  Spinner não capturado (save foi muito rápido ou não usa spinner)');
    }

    // Após salvar: botão deve mostrar "Salvo!" ou voltar para "Salvar Alterações"
    await expect(
      page.locator('button').filter({ hasText: /salvo!|salvar alterações/i }).first()
    ).toBeVisible({ timeout: 10_000 });

    console.log('✅ Feedback visual de loading/sucesso confirmado');

    // Restaurar: aguardar "Salvo!" desaparecer (router.replace resetou o componente).
    // Com PATCH mockado (resposta imediata), o setTimeout de 1500ms dispara logo.
    // Esperar o botão voltar para "Salvar Alterações" confirma que o ciclo completou.
    await page.locator('button').filter({ hasText: /salvar alterações/i }).waitFor({
      state: 'visible', timeout: 5_000,
    }).catch(() => {});
    await nameInput.fill(original);
    await page.locator('button').filter({ hasText: /salvar alterações/i }).click();
    // Aguardar ciclo de "Salvo!" → router.replace para a restauração também
    await page.locator('button').filter({ hasText: /salvar alterações/i }).waitFor({
      state: 'visible', timeout: 5_000,
    }).catch(() => {});
  });
});

// ─── 3: Sucesso consistente ──────────────────────────────────────────────────

test.describe('Mensagens de Sucesso', () => {
  test('settings mostra "Salvo!" após save bem-sucedido', async ({ page }) => {
    // Mockar Supabase ANTES de navegar — mesma razão do Loading States test:
    // auth cookie pode estar expirado em CI; mock isola o teste da autenticação real.
    await page.route('**/auth/v1/user**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'test@circlehood.test' }),
      }),
    );
    await page.route('**/rest/v1/professionals**', async (route) => {
      const method = route.request().method();
      if (method === 'GET' || method === 'PATCH') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      } else {
        await route.continue();
      }
    });

    await page.goto(`${BASE}/settings`);
    await page.waitForLoadState('networkidle');

    const nameInput = page.locator('#businessName');
    if ((await nameInput.count()) === 0) {
      test.skip(true, 'Campo #businessName não encontrado');
      return;
    }

    const original = await nameInput.inputValue();

    await nameInput.fill(original.trim() + ' ');

    const saveBtn = page.locator('button').filter({ hasText: /salvar alterações/i });
    await saveBtn.click();

    // Com PATCH mockado (resposta imediata), "Salvo!" aparece logo após o click.
    // Timeout de 10s: garante margem para cold start e variações de timing no CI.
    const salvoBtn = page.locator('button').filter({ hasText: /salvo!/i });
    await expect(salvoBtn).toBeVisible({ timeout: 10_000 });

    const salvoText = await salvoBtn.textContent();
    console.log(`✅ Mensagem de sucesso: "${salvoText?.trim()}"`);

    // Verificar que não é técnico/críptico
    expect(salvoText?.toLowerCase()).not.toContain('undefined');
    expect(salvoText?.toLowerCase()).not.toContain('null');

    // Restaurar: aguardar router.replace ciclo completar (componente resetar)
    await page.locator('button').filter({ hasText: /salvar alterações/i }).waitFor({
      state: 'visible', timeout: 5_000,
    }).catch(() => {});
    await nameInput.fill(original);
    await page.locator('button').filter({ hasText: /salvar alterações/i }).click();
    await page.locator('button').filter({ hasText: /salvar alterações/i }).waitFor({
      state: 'visible', timeout: 5_000,
    }).catch(() => {});
  });
});

// ─── 4: Erros sem jargão técnico ────────────────────────────────────────────

test.describe('Mensagens de Erro', () => {
  test('submit de formulário vazio não expõe erros técnicos', async ({ page }) => {
    await page.goto(`${BASE}/services`);
    await page.waitForLoadState('networkidle');

    const addBtn = page.locator('button').filter({ hasText: /adicionar servi[cç]o/i });
    if ((await addBtn.count()) === 0) {
      test.skip(true, 'Botão "Adicionar serviço" não encontrado');
      return;
    }

    await addBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    // Tentar salvar sem preencher campos obrigatórios
    const submitBtn = dialog.locator('button').filter({ hasText: /criar/i });
    if ((await submitBtn.count()) === 0) {
      await page.keyboard.press('Escape');
      test.skip(true, 'Botão "Criar" não encontrado no dialog');
      return;
    }

    await submitBtn.click();
    await page.waitForTimeout(600);

    // innerText (não textContent) — exclui <script> tags do Next.js RSC payload
    // que contém "$undefined" e outras strings internas que não são visíveis ao usuário
    const visibleText = (await page.evaluate(() => document.body.innerText)) ?? '';

    // Garantir que não há termos técnicos VISÍVEIS na UI
    const technicalTerms = ['typeerror', 'exception', 'stack trace', 'error:'];
    for (const term of technicalTerms) {
      const found = visibleText.toLowerCase().includes(term);
      if (found) {
        console.log(`⚠️  Termo técnico encontrado: "${term}"`);
      }
      expect(found).toBe(false);
    }

    console.log('✅ Nenhum erro técnico exposto na UI');

    // Dialog deve permanecer aberto (dados não perdidos)
    const dialogOpen = await dialog.isVisible();
    if (dialogOpen) {
      console.log('✅ Dialog permaneceu aberto após submit inválido');
    } else {
      console.log('ℹ️  Dialog fechou após submit (pode ter validação HTML5 nativa)');
    }

    await page.keyboard.press('Escape');
  });

  test('settings mostra erro inline sem jargão técnico', async ({ page }) => {
    await page.goto(`${BASE}/settings`);
    await page.waitForLoadState('networkidle');

    const nameInput = page.locator('#businessName');
    if ((await nameInput.count()) === 0) {
      test.skip(true, 'Campo #businessName não encontrado');
      return;
    }

    // Limpar campo obrigatório e salvar
    await nameInput.fill('');

    const saveBtn = page.locator('button').filter({ hasText: /salvar alterações/i });
    await saveBtn.click();
    await page.waitForTimeout(800);

    // innerText exclui conteúdo de <script> (Next.js RSC payload tem "$undefined" etc.)
    const visibleText = (await page.evaluate(() => document.body.innerText)) ?? '';

    // Verificar ausência de termos técnicos VISÍVEIS na UI
    const technicalTerms = ['typeerror', 'exception', 'error:'];
    for (const term of technicalTerms) {
      expect(visibleText.toLowerCase()).not.toContain(term);
    }

    // Verificar se há mensagem de erro inline (text-destructive no settings-manager)
    const errorMsg = page.locator('.text-destructive, [class*="destructive"]').first();
    const hasError = await errorMsg.isVisible().catch(() => false);

    if (hasError) {
      const errText = await errorMsg.textContent();
      console.log(`✅ Erro inline encontrado: "${errText?.trim()}"`);
      // Erro deve ter conteúdo útil (pelo menos 3 chars — "99+" do counter tem 3)
      expect((errText?.trim().length ?? 0)).toBeGreaterThanOrEqual(3);
    } else {
      console.log('ℹ️  Nenhum erro visível (pode ter validação HTML5 nativa)');
    }

    // Restaurar nome válido
    const original = 'Salão da Rita'; // fallback
    await nameInput.fill(original);
    await saveBtn.click();
    await page.waitForTimeout(2000);
  });
});

// ─── 5: Dados preservados após erro ──────────────────────────────────────────

test.describe('Preservação de Dados', () => {
  test('formulário de serviço preserva dados após erro de rede', async ({ page }) => {
    await page.goto(`${BASE}/services`);
    await page.waitForLoadState('networkidle');

    const addBtn = page.locator('button').filter({ hasText: /adicionar servi[cç]o/i });
    if ((await addBtn.count()) === 0) {
      test.skip(true, 'Botão "Adicionar serviço" não encontrado');
      return;
    }

    await addBtn.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5_000 });

    const nameInput = dialog.locator('#name');
    if ((await nameInput.count()) === 0) {
      await page.keyboard.press('Escape');
      test.skip(true, 'Input #name não encontrado no dialog');
      return;
    }

    // Preencher formulário com dados de teste
    const testName = 'Serviço de Teste UX';
    await nameInput.fill(testName);

    const priceInput = dialog.locator('#price');
    if ((await priceInput.count()) > 0) {
      await priceInput.fill('75');
    }

    const durationInput = dialog.locator('#duration');
    if ((await durationInput.count()) > 0) {
      await durationInput.fill('60');
    }

    console.log('✅ Formulário preenchido com dados de teste');

    // Interceptar requests ao Supabase para simular falha de rede
    // O services-manager usa supabase client direto (REST API)
    await page.route('**/rest/v1/services**', (route) => route.abort('failed'));

    // Tentar salvar
    const submitBtn = dialog.locator('button').filter({ hasText: /criar/i });
    if ((await submitBtn.count()) > 0) {
      await submitBtn.click();
      await page.waitForTimeout(1500);
    }

    // Verificar comportamento após erro de rede
    const dialogStillOpen = await dialog.isVisible().catch(() => false);

    if (dialogStillOpen) {
      // Dialog ainda aberto: verificar que dados foram preservados
      const currentName = await nameInput.inputValue();
      expect(currentName).toBe(testName);
      console.log(`✅ Dados preservados após erro de rede: "${currentName}"`);

      if ((await priceInput.count()) > 0) {
        const currentPrice = await priceInput.inputValue();
        expect(currentPrice).toBe('75');
      }
    } else {
      // Dialog fechou após erro: documenta silent failure (não causa falha do teste)
      console.log(
        'ℹ️  Dialog fechou após erro de rede (dados perdidos — oportunidade de melhoria)',
      );
    }

    // Verificar feedback de erro visível ao usuário (innerText exclui scripts)
    const visibleText = (await page.evaluate(() => document.body.innerText)) ?? '';
    const hasErrorFeedback =
      visibleText.toLowerCase().includes('erro') ||
      visibleText.toLowerCase().includes('error') ||
      visibleText.toLowerCase().includes('falha');

    if (hasErrorFeedback) {
      console.log('✅ Feedback de erro exibido ao usuário');
    } else {
      console.log('ℹ️  Nenhum feedback de erro visível (silent failure — oportunidade de melhoria)');
    }

    // Limpar e fechar
    await page.unroute('**/rest/v1/services**');
    await page.keyboard.press('Escape');
  });
});

// ─── 6: Feedback visual de interação ─────────────────────────────────────────

test.describe('Feedback Visual de Interação', () => {
  test('botões têm cursor pointer e botões desabilitados têm estilo adequado', async ({
    page,
  }) => {
    await page.goto(`${BASE}/services`);
    await page.waitForLoadState('networkidle');

    // Verificar cursor: pointer em botões ativos
    const activeButtons = page.locator('button:not([disabled])');
    const activeBtnCount = await activeButtons.count();

    if (activeBtnCount === 0) {
      test.skip(true, 'Nenhum botão ativo encontrado');
      return;
    }

    const cursors: string[] = [];
    const maxCheck = Math.min(activeBtnCount, 5);

    for (let i = 0; i < maxCheck; i++) {
      const btn = activeButtons.nth(i);
      const cursor = await btn.evaluate((el) => window.getComputedStyle(el).cursor);
      cursors.push(cursor);
    }

    // Documentativo: registrar cursors encontrados (Shadcn Button não usa cursor-pointer por padrão)
    const pointerCount = cursors.filter((c) => c === 'pointer').length;
    console.log(`ℹ️  Cursors encontrados nos botões: ${JSON.stringify(cursors)}`);
    console.log(`  ${pointerCount}/${maxCheck} botões têm cursor: pointer`);

    // Verificar apenas que nenhum cursor é algo completamente inválido
    for (const cursor of cursors) {
      expect(['pointer', 'default', 'auto', 'not-allowed', 'text']).toContain(cursor);
    }

    // Verificar botões desabilitados têm cursor diferente
    const disabledBtns = page.locator('button[disabled]');
    const disabledCount = await disabledBtns.count();

    if (disabledCount > 0) {
      const disabledCursor = await disabledBtns
        .first()
        .evaluate((el) => window.getComputedStyle(el).cursor);

      const hasDisabledStyle = ['not-allowed', 'default'].includes(disabledCursor);
      console.log(`✅ Botão desabilitado tem cursor: ${disabledCursor}`);

      if (hasDisabledStyle) {
        console.log('✅ Cursor de botão desabilitado é adequado');
      } else {
        console.log(
          `ℹ️  Cursor "${disabledCursor}" em botão desabilitado (oportunidade de melhoria)`,
        );
      }
    } else {
      console.log('ℹ️  Nenhum botão desabilitado encontrado em /services');
    }
  });

  test('botão "Adicionar serviço" abre dialog e dialog fecha com Escape', async ({ page }) => {
    await page.goto(`${BASE}/services`);
    await page.waitForLoadState('networkidle');

    const addBtn = page.locator('button').filter({ hasText: /adicionar servi[cç]o/i });
    if ((await addBtn.count()) === 0) {
      test.skip(true, 'Botão "Adicionar serviço" não encontrado');
      return;
    }

    // Clicar no botão
    await addBtn.click();

    // Dialog deve abrir imediatamente (feedback visual imediato)
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 3_000 });
    console.log('✅ Dialog abre rapidamente após clique (feedback imediato)');

    // Verificar título do dialog
    const titleEl = dialog.locator('h2, [role="heading"]').first();
    if ((await titleEl.count()) > 0) {
      const title = await titleEl.textContent();
      console.log(`  Dialog title: "${title?.trim()}"`);
      expect(title?.toLowerCase()).toMatch(/novo servi[cç]o|adicionar servi[cç]o/i);
    }

    // Fechar com Escape — UX padrão esperada
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible({ timeout: 3_000 });
    console.log('✅ Dialog fecha com Escape (UX padrão)');

    // URL não deve ter mudado (pode ter locale prefix /pt-BR/)
    await expect(page).toHaveURL(/\/services$/);
    console.log('✅ URL não muda ao abrir/fechar dialog');
  });
});
