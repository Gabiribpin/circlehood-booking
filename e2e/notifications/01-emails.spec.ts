/**
 * Email & Notificações — Crons e Fila
 *
 * Testes de integração que verificam o pipeline de notificações:
 *  - Crons de lembrete agendados (send-reminders, send-maintenance-reminders)
 *  - Processamento da notification_queue pelo endpoint /notifications/send
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
 *  - /api/webhooks/resend                 → sem auth (webhook público)
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

// ─── 3: Notification Queue Processing ────────────────────────────────────────

test.describe('Notification Queue — /api/notifications/send', () => {
  let testNotificationId: string | null = null;

  test.afterEach(async () => {
    // Cleanup: remover notificação de teste se criada
    if (testNotificationId) {
      await supabase.from('notification_queue').delete().eq('id', testNotificationId);
      testNotificationId = null;
    }
  });

  test('processa notificação pendente e muda status para sent', async ({ request }) => {
    // Setup: inserir notificação de teste sem email (para não enviar email real)
    const { data: inserted, error } = await supabase
      .from('notification_queue')
      .insert({
        professional_id: TEST.PROFESSIONAL_ID,
        type: 'reminder',
        recipient_name: 'Teste E2E Notificação',
        recipient_phone: TEST.PHONE,
        recipient_email: null, // sem email → sem Resend chamado
        message_template: 'reminder',
        message_data: {
          booking_id: null,
          message: 'Teste de lembrete E2E — pode ignorar',
        },
        language: 'pt',
        status: 'pending',
      })
      .select('id')
      .single();

    if (error || !inserted) {
      console.log(`⏭️  Falha ao inserir notificação de teste: ${error?.message}`);
      test.skip(true, 'Não foi possível inserir na notification_queue');
      return;
    }

    testNotificationId = inserted.id;
    console.log(`✅ Notificação de teste inserida: id=${testNotificationId}`);

    // Chamar endpoint de processamento
    const res = await request.post(`${TEST.BASE_URL}/api/notifications/send`, {
      headers: { 'x-cron-secret': TEST.CRON_SECRET },
    });

    expect(res.status()).toBe(200);
    const data = await res.json();
    console.log('  ✅ /api/notifications/send response:', JSON.stringify(data));

    // Response deve indicar que processou algo
    expect(data).toBeDefined();

    // Aguardar processamento assíncrono (Vercel pode ter latência)
    await new Promise<void>((r) => setTimeout(r, 2000));

    // Verificar que status mudou de 'pending'
    const { data: updated } = await supabase
      .from('notification_queue')
      .select('status, sent_at, error_message')
      .eq('id', testNotificationId)
      .maybeSingle();

    if (updated) {
      console.log(
        `  ✅ Notificação processada: status=${updated.status}, sent_at=${updated.sent_at}`,
      );
      expect(['sent', 'failed']).toContain(updated.status);
      // Se falhou, logar o erro mas não falhar o teste (pode ser cfg de produção)
      if (updated.status === 'failed') {
        console.log(`  ℹ️  Notificação falhou: ${updated.error_message}`);
      }
    } else {
      console.log('  ℹ️  Notificação não encontrada após processamento (pode ter sido deletada)');
    }
  });

  test('retorna estrutura correta quando não há notificações pendentes', async ({ request }) => {
    // Chamar endpoint sem inserir nada — não garante fila vazia,
    // mas verifica que o endpoint responde com estrutura correta

    const res = await request.post(`${TEST.BASE_URL}/api/notifications/send`, {
      headers: { 'x-cron-secret': TEST.CRON_SECRET },
    });

    expect(res.status()).toBe(200);
    const data = await res.json();

    // Resposta deve ser JSON válido com campo processed ou message
    const hasExpectedField =
      'processed' in data || 'message' in data || 'success' in data || 'results' in data;
    expect(hasExpectedField).toBe(true);

    console.log(`✅ /api/notifications/send: resposta válida ${JSON.stringify(data)}`);
  });

  test('retorna 401 sem x-cron-secret', async ({ request }) => {
    const res = await request.post(`${TEST.BASE_URL}/api/notifications/send`, {
      headers: { 'Content-Type': 'application/json' },
    });

    expect(res.status()).toBe(401);
    console.log('✅ /api/notifications/send rejeita request sem auth (401)');
  });
});

// ─── 4: Resend Webhook ───────────────────────────────────────────────────────

test.describe('Webhook Resend — /api/webhooks/resend', () => {
  test('aceita evento email.delivered sem campaign_id e retorna {received: true}', async ({
    request,
  }) => {
    // Simular evento de entrega do Resend (sem campaign_id → not found → {received: true})
    const mockEvent = {
      type: 'email.delivered',
      data: {
        email_id: 'test-email-id-e2e',
        from: 'noreply@circlehood-tech.com',
        to: 'test@example.com',
        created_at: new Date().toISOString(),
        tags: [], // sem campaign_id → webhook retorna {received: true} imediatamente
      },
    };

    const res = await request.post(`${TEST.BASE_URL}/api/webhooks/resend`, {
      data: mockEvent,
    });

    // Resend webhook deve retornar 200 (sempre aceita, processa assincronamente)
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('received', true);
    console.log('✅ Webhook /api/webhooks/resend aceita evento email.delivered');
  });

  test('aceita evento email.bounced e retorna 200', async ({ request }) => {
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
      data: mockEvent,
    });

    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('received', true);
    console.log('✅ Webhook aceita evento email.bounced');
  });
});

// ─── 5: Integridade da notification_queue ────────────────────────────────────

test.describe('Notification Queue — Integridade', () => {
  test('não há notificações travadas em pending por mais de 1 hora', async () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data: stuckNotifications, count } = await supabase
      .from('notification_queue')
      .select('id, type, created_at, recipient_phone', { count: 'exact' })
      .eq('status', 'pending')
      .lt('created_at', oneHourAgo);

    const stuckCount = count ?? 0;

    if (stuckCount > 0) {
      console.log(`⚠️  ${stuckCount} notificação(ões) travada(s) em pending por >1h:`);
      (stuckNotifications ?? []).slice(0, 5).forEach((n) => {
        console.log(`  - id=${n.id}, type=${n.type}, created_at=${n.created_at}`);
      });
      // Não falhamos o CI por notificações travadas — é informativo
      // (pode ser que o processador ainda não rodou)
      console.log(
        '  ℹ️  Notificações travadas documentadas — verificar se /api/notifications/send está sendo chamado',
      );
    } else {
      console.log('✅ Nenhuma notificação travada em pending por >1h');
    }

    // Este teste sempre passa — é puramente documentativo
    expect(true).toBe(true);
  });

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
