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

  // Salvar estado de autenticação (cookies + localStorage)
  await page.context().storageState({ path: authFile });

  console.log(`✅ Auth salva em: ${authFile}`);
});
