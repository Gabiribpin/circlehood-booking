/**
 * Teste E2E — Health endpoint authorization
 *
 * /api/admin/health expoe metricas internas (Redis, webhooks, conexoes).
 * Deve ser acessivel APENAS com sessao admin valida.
 */
import { test, expect } from '@playwright/test';
import { TEST } from '../helpers/config';

const BASE = TEST.BASE_URL;

test.describe('Health Endpoint — Authorization', () => {
  test('GET /api/admin/health sem cookie admin → 401', async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/health`);
    // Se a rota ainda não está deployada, skip
    if (res.status() === 404) {
      test.skip(true, 'Rota /api/admin/health não deployada no servidor de teste');
    }
    expect(res.status()).toBe(401);
  });

  test('GET /api/admin/health com cookie admin → 200 + estrutura valida', async ({ request }) => {
    // Login como admin
    const loginRes = await request.post(`${BASE}/api/admin/auth`, {
      data: { password: process.env.ADMIN_PASSWORD },
    });

    if (loginRes.status() !== 200) {
      test.skip(true, 'ADMIN_PASSWORD nao configurada ou incorreta');
    }

    // Extrair cookie da resposta de login
    const setCookieHeader = loginRes.headers()['set-cookie'];
    if (!setCookieHeader) {
      test.skip(true, 'Login admin nao retornou cookie');
    }

    // Acessar health com cookie admin
    const healthRes = await request.get(`${BASE}/api/admin/health`, {
      headers: { Cookie: setCookieHeader },
    });

    expect(healthRes.status()).toBe(200);
    const data = await healthRes.json();

    // Verificar estrutura do response
    expect(data).toHaveProperty('timestamp');
    expect(data).toHaveProperty('redis');
    expect(data).toHaveProperty('redis.status');
    expect(data).toHaveProperty('redis.active_limits');
    expect(data).toHaveProperty('webhooks');
    expect(data).toHaveProperty('webhooks.recent');
    expect(data).toHaveProperty('webhooks.success_rate_24h');
    expect(data).toHaveProperty('webhooks.avg_processing_ms');
    expect(data).toHaveProperty('whatsapp');
    expect(data).toHaveProperty('whatsapp.total_connections');
    expect(data).toHaveProperty('whatsapp.bot_enabled_count');

    // Types
    expect(typeof data.webhooks.success_rate_24h).toBe('number');
    expect(typeof data.webhooks.avg_processing_ms).toBe('number');
    expect(Array.isArray(data.webhooks.recent)).toBe(true);
  });
});
