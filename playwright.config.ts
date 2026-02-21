import { defineConfig } from '@playwright/test';
import * as dotenv from 'dotenv';

// Carrega .env.production.local para ter as keys de produção
dotenv.config({ path: '.env.production.local' });
dotenv.config({ path: '.env.local' });

export default defineConfig({
  testDir: './e2e',
  // 45s por teste: cold start Vercel pode levar ~5-6s na primeira request de cada job CI
  timeout: 45_000,
  retries: 0,
  // Workers = 1: testes de bot são sequenciais para evitar race conditions no DB
  workers: 1,
  // Expect timeout 10s: default 5s não aguenta cold start (~5-6s) → falsos negativos
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { outputFolder: 'e2e-report', open: 'never' }]],

  use: {
    baseURL: process.env.TEST_BASE_URL ?? 'https://circlehood-booking.vercel.app',
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
    // Screenshots e traces só em falha (para debug)
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },

  projects: [
    // ─── Setup: login único, salva sessão ────────────────────────────
    {
      name: 'auth-setup',
      testMatch: 'e2e/auth/setup.ts',
      use: { browserName: 'chromium', headless: true },
    },

    // ─── Bot: testes de API (sem browser) ────────────────────────────
    {
      name: 'bot-api',
      testMatch: '**/bot/**/*.spec.ts',
    },

    // ─── API pública e ciclo do profissional (sem browser) ───────────
    {
      name: 'api-tests',
      testMatch: '**/api/**/*.spec.ts',
    },

    // ─── Segurança: auth, autorização, injeção (sem browser) ─────────
    {
      name: 'security',
      testMatch: '**/security/**/*.spec.ts',
    },

    // ─── Dashboard smoke público (sem auth) ──────────────────────────
    {
      name: 'dashboard-public',
      testMatch: '**/dashboard/01-smoke.spec.ts',
      use: { browserName: 'chromium', headless: true },
    },

    // ─── Jornada do usuário: registro + onboarding (usa sessão salva) ──
    {
      name: 'user-journey',
      testMatch: '**/user-journey/**/*.spec.ts',
      use: {
        browserName: 'chromium',
        headless: true,
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['auth-setup'],
    },

    // ─── Dashboard autenticado (usa sessão salva pelo auth-setup) ────
    {
      name: 'dashboard',
      testMatch: '**/dashboard/0[2-9]-*.spec.ts',
      use: {
        browserName: 'chromium',
        headless: true,
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['auth-setup'],
    },
  ],
});
