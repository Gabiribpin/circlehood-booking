import { defineConfig } from '@playwright/test';
import * as dotenv from 'dotenv';

// Carrega .env.production.local para ter as keys de produção
dotenv.config({ path: '.env.production.local' });
dotenv.config({ path: '.env.local' });

export default defineConfig({
  testDir: './e2e',
  timeout: 20_000,
  retries: 0,
  // Workers = 1: testes de bot são sequenciais para evitar race conditions no DB
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'e2e-report', open: 'never' }]],

  use: {
    baseURL: process.env.TEST_BASE_URL ?? 'https://circlehood-booking.vercel.app',
    extraHTTPHeaders: {
      'Content-Type': 'application/json',
    },
  },

  projects: [
    {
      name: 'bot-api',
      testMatch: '**/bot/**/*.spec.ts',
      // API-only: não precisa de browser
    },
    {
      name: 'dashboard',
      testMatch: '**/dashboard/**/*.spec.ts',
      use: { browserName: 'chromium', headless: true },
    },
  ],
});
