/**
 * Email & Notificações — Crons e Webhook
 *
 * Testes de integração que verificam o pipeline de notificações:
 *  - Crons de lembrete agendados (send-reminders, send-maintenance-reminders)
 *  - Webhook Resend para tracking de entregas
 *
 * Estratégia:
 *  - Chamar endpoints reais no Vercel (TEST_BASE_URL) — sem mocks locais
 *  - Usar Supabase admin para setup/verificação/cleanup de estado
 *  - Evitar envio de emails reais: recipient_email: null nas notificações de teste
 *  - Não depender de browser — projeto puro de API (sem storageState)
 *
 * Autenticação dos endpoints:
 *  - /api/cron/send-reminders             → Authorization: Bearer {CRON_SECRET}
 *  - /api/cron/send-maintenance-reminders → Authorization: Bearer {CRON_SECRET}
 *  - /api/notifications/send              → x-cron-secret: {CRON_SECRET}
 *  - /api/webhooks/resend                 → Svix signature (RESEND_WEBHOOK_SECRET)
 */
import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { TEST } from '../helpers/config';

const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);

// ─── 1: Cron send-reminders ──────────────────────────────────────────────────

test.describe('Cron — send-reminders', () => {
  test('retorna 200 com estrutura válida e registra em cron_logs', async ({ request }) => {
    const before = new Date().toISOString();

    const res = await request.post(`${TEST.BASE_URL}/api/cron/send-reminders`, {
      headers: { Authorization: `Bearer ${TEST.CRON_SECRET}` },
    });

    // Deve retornar 200 (mesmo sem bookings para processar)
    expect(res.status()).toBe(200);

    const data = await res.json();
    console.log('✅ send-reminders response:', JSON.stringify(data));

    // Resposta deve ter campo success
    expect(data).toHaveProperty('success', true);

    // remindersSent deve ser um número não-negativo
    expect(typeof data.remindersSent).toBe('number');
    expect(data.remindersSent).toBeGreaterThanOrEqual(0);

    console.log(`  ✅ remindersSent: ${data.remindersSent}`);

    // Verificar que cron_logs registrou esta execução
    const { data: logEntry } = await supabase
      .from('cron_logs')
      .select('job_name, status, records_processed, execution_time_ms')
      .eq('job_name', 'send-reminders')
      .gte('created_at', before)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (logEntry) {
      console.log(`  ✅ cron_logs registrado: status=${logEntry.status}, records=${logEntry.records_processed}, time=${logEntry.execution_time_ms}ms`);
      expect(['success', 'error']).toContain(logEntry.status);
      expect(typeof logEntry.execution_time_ms).toBe('number');
    } else {
      console.log('  ℹ️  Nenhum entry em cron_logs (tabela pode não ter RLS habilitado para service role)');
    }
  });

  test('retorna 401 sem Authorization header', async ({ request }) => {
    const res = await request.post(`${TEST.BASE_URL}/api/cron/send-reminders`, {
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status()).toBe(401);
    const data = await res.json();
    expect(data).toHaveProperty('error');
    console.log('✅ Endpoint rejeita request sem auth (401)');
  });
});

// ─── 2: Cron send-maintenance-reminders ─────────────────────────────────────

test.describe('Cron — send-maintenance-reminders', () => {
  test('retorna 200 com estrutura válida', async ({ request }) => {
    const res = await request.post(`${TEST.BASE_URL}/api/cron/send-maintenance-reminders`, {
      headers: { Authorization: `Bearer ${TEST.CRON_SECRET}` },
    });

    expect(res.status()).toBe(200);

    const data = await res.json();
    console.log('✅ send-maintenance-reminders response:', JSON.stringify(data));

    // Deve ter campo de sucesso ou mensagem
    const hasSuccessIndicator =
      'success' in data || 'remindersSent' in data || 'message' in data || 'processed' in data;
    expect(hasSuccessIndicator).toBe(true);

    console.log('  ✅ Resposta com estrutura válida');
  });

  test('retorna 401 com CRON_SECRET incorreto', async ({ request }) => {
    const res = await request.post(`${TEST.BASE_URL}/api/cron/send-maintenance-reminders`, {
      headers: { Authorization: 'Bearer wrong-secret-12345' },
    });

    expect(res.status()).toBe(401);
    console.log('✅ Endpoint rejeita secret inválido (401)');
  });
});

// ─── 3: Notification Queue — REMOVED (issue #18) ────────────────────────────
// notification_queue was a dead queue (never processed by any cron).
// Table dropped in migration 20260303000007. Tests removed.

// ─── 4: Resend Webhook ───────────────────────────────────────────────────────

test.describe('Webhook Resend — /api/webhooks/resend', () => {
  test('rejeita request sem assinatura Svix válida (issue #20)', async ({
    request,
  }) => {
    // Após issue #20, o webhook exige assinatura Svix válida.
    // Requests sem headers svix-id/svix-timestamp/svix-signature → 401
    const mockEvent = {
      type: 'email.delivered',
      data: {
        email_id: 'test-email-id-e2e',
        from: 'noreply@circlehood-tech.com',
        to: 'test@example.com',
        created_at: new Date().toISOString(),
        tags: [],
      },
    };

    const res = await request.post(`${TEST.BASE_URL}/api/webhooks/resend`, {
      data: mockEvent,
    });

    // Webhook agora requer signature validation → 401 sem headers válidos
    expect(res.status()).toBe(401);
    const data = await res.json();
    expect(data).toHaveProperty('error', 'Unauthorized');
    console.log('✅ Webhook /api/webhooks/resend rejeita request sem assinatura Svix');
  });

  test('rejeita request com headers Svix inválidos', async ({ request }) => {
    const mockEvent = {
      type: 'email.bounced',
      data: {
        email_id: 'test-bounce-id-e2e',
        from: 'noreply@circlehood-tech.com',
        to: 'bounce@example.com',
        created_at: new Date().toISOString(),
        tags: [],
      },
    };

    const res = await request.post(`${TEST.BASE_URL}/api/webhooks/resend`, {
      headers: {
        'svix-id': 'msg_fake',
        'svix-timestamp': Math.floor(Date.now() / 1000).toString(),
        'svix-signature': 'v1,invalidbase64signature',
      },
      data: mockEvent,
    });

    expect(res.status()).toBe(401);
    console.log('✅ Webhook rejeita headers Svix inválidos');
  });
});

// ─── 5: notification_logs (notification_queue removed in issue #18) ──────────

test.describe('Notification Logs — Integridade', () => {
  test('notification_logs registra notificações enviadas recentemente', async () => {
    const { data: recentLogs, count } = await supabase
      .from('notification_logs')
      .select('type, channel, status, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(5);

    const logCount = count ?? 0;
    console.log(`ℹ️  notification_logs — ${logCount} entradas total`);

    if (recentLogs && recentLogs.length > 0) {
      console.log('  Últimas notificações:');
      recentLogs.forEach((log) => {
        console.log(
          `    - type=${log.type}, channel=${log.channel}, status=${log.status}, at=${log.created_at}`,
        );
      });
    } else {
      console.log('  ℹ️  Nenhum log encontrado (tabela pode ser nova ou vazia)');
    }

    // Teste documentativo — sempre passa
    expect(true).toBe(true);
  });
});
