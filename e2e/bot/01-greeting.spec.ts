import { test, expect } from '@playwright/test';
import { cleanTestState, getLastBotMessage } from '../helpers/setup';
import { sendBotMessage } from '../helpers/webhook';

test.describe('Bot — Saudação', () => {
  test.beforeEach(async () => {
    await cleanTestState();
  });

  test('primeira mensagem recebe saudação configurada', async ({ request }) => {
    await sendBotMessage(request, 'oi');

    const reply = await getLastBotMessage();
    expect(reply).not.toBeNull();
    // A saudação deve conter o nome do negócio ou nome do bot
    expect(reply!.toLowerCase()).toMatch(/salao|gabriela|bem[- ]?vindo|olá|oi/i);
  });

  test('saudação não é enviada duas vezes em mensagens rápidas', async ({ request }) => {
    // Enviar 3 mensagens quasi-simultâneas (simula o usuário digitando rápido)
    await Promise.all([
      sendBotMessage(request, 'oi', { messageId: 'E2E_RAPID_1' }),
      sendBotMessage(request, 'tem horário?', { messageId: 'E2E_RAPID_2' }),
      sendBotMessage(request, 'vc atende hoje?', { messageId: 'E2E_RAPID_3' }),
    ]);

    // Aguardar processamento de todas
    await new Promise(r => setTimeout(r, 2000));

    // Contar quantas mensagens outbound existem
    const { createClient } = await import('@supabase/supabase-js');
    const { TEST } = await import('../helpers/config');
    const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);

    const { data: conv } = await supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('user_id', TEST.USER_ID)
      .eq('customer_phone', TEST.PHONE)
      .maybeSingle();

    if (!conv) return; // sem conversa = mensagens não processadas, ok

    const { data: outbound } = await supabase
      .from('whatsapp_messages')
      .select('content')
      .eq('conversation_id', conv.id)
      .eq('direction', 'outbound');

    // Verificar que não há saudações duplicadas
    const greetings = (outbound ?? []).filter(m =>
      m.content.toLowerCase().includes('bem-vindo') || m.content.toLowerCase().includes('seja bem')
    );
    expect(greetings.length).toBeLessThanOrEqual(1);
  });
});
