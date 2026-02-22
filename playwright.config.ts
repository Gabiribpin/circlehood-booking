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
      // 1 retry: protege contra falhas transitórias de Redis/Supabase replica lag
      retries: 1,
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

    // ─── Smoke público: Chromium (Chrome/Edge) ───────────────────────
    {
      name: 'smoke-chromium',
      testMatch: '**/dashboard/01-smoke.spec.ts',
      use: { browserName: 'chromium', headless: true },
    },

    // ─── Smoke público: WebKit (Safari) ──────────────────────────────
    {
      name: 'smoke-webkit',
      testMatch: '**/dashboard/01-smoke.spec.ts',
      retries: 1, // Safari pode ter timing diferente no CI
      use: { browserName: 'webkit', headless: true },
    },

    // ─── Smoke público: Firefox ───────────────────────────────────────
    {
      name: 'smoke-firefox',
      testMatch: '**/dashboard/01-smoke.spec.ts',
      retries: 1, // Firefox pode ter timing diferente no CI
      use: { browserName: 'firefox', headless: true },
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

    // ─── Navegação e consistência de UX (usa sessão salva) ───────────
    {
      name: 'navigation',
      testMatch: '**/navigation/**/*.spec.ts',
      use: {
        browserName: 'chromium',
        headless: true,
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['auth-setup'],
    },

    // ─── UX consistency (estados, feedback, formulários) ─────────────
    {
      name: 'ux',
      testMatch: '**/ux/**/*.spec.ts',
      use: {
        browserName: 'chromium',
        headless: true,
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['auth-setup'],
    },

    // ─── Notificações e emails (crons, fila, webhook Resend) ─────────
    {
      name: 'notifications',
      testMatch: '**/notifications/**/*.spec.ts',
      // Testes de API pura — sem browser nem storageState
      // Auth feita via CRON_SECRET e Supabase service role diretamente
    },

    // ─── Mobile responsive (iPhone SE, iPhone 12, Pixel 5) ───────────
    {
      name: 'mobile',
      testMatch: '**/mobile/**/*.spec.ts',
      use: {
        browserName: 'chromium',
        headless: true,
        storageState: 'e2e/.auth/user.json',
        hasTouch: true,
        isMobile: true,
        // Viewport padrão iPhone 12 (cada teste redefine o seu)
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
      },
      dependencies: ['auth-setup'],
    },
  ],
});
