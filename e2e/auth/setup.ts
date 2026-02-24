/**
 * Auth setup — executa UMA VEZ antes dos testes de dashboard.
 * Faz login, salva cookies/sessão em e2e/.auth/user.json.
 * Os testes de dashboard carregam esse arquivo via storageState.
 */
import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { TEST } from '../helpers/config';

const authFile = path.join(__dirname, '../.auth/user.json');

setup('autenticar Salão da Rita', async ({ page }) => {
  await page.goto(`${TEST.BASE_URL}/login`);

  // Aguardar formulário carregar
  await expect(page.locator('#email')).toBeVisible({ timeout: 15_000 });

  await page.fill('#email', TEST.USER_EMAIL);
  await page.fill('#password', TEST.USER_PASSWORD);
  await page.click('button[type="submit"]');

  // Aguardar redirect para o dashboard após login
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });

  // Verificar que o dashboard carregou (não ficou em loop de login)
  await expect(page.locator('body')).not.toContainText('Entrar', { timeout: 5_000 });

  // Marcar modal de boas-vindas e tour guiado como já vistos — evita que
  // bloqueiem os testes (GuidedTour usa backdrop fixed inset-0 z-[100]).
  await page.evaluate(() => {
    localStorage.setItem('whatsapp-warning-seen', 'true');
    localStorage.setItem('circlehood-tour-completed', 'true');
  });

  // Forçar locale pt-BR via cookie — evita que o CI (Accept-Language: en-US)
  // redirecione para /en-US/* e quebre verificações de URL e texto do sidebar.
  const baseUrl = new URL(TEST.BASE_URL);
  await page.context().addCookies([{
    name: 'NEXT_LOCALE',
    value: 'pt-BR',
    domain: baseUrl.hostname,
    path: '/',
  }]);

  // Salvar estado de autenticação (cookies + localStorage)
  await page.context().storageState({ path: authFile });

  console.log(`✅ Auth salva em: ${authFile}`);
});
