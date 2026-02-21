import { APIRequestContext } from '@playwright/test';
import { TEST } from './config';

let msgCounter = 0;

/**
 * Envia uma mensagem ao bot via webhook Evolution (simula uma mensagem WhatsApp real).
 * O webhook é síncrono — quando retorna 200 o bot já processou e o DB está atualizado.
 */
export async function sendBotMessage(
  request: APIRequestContext,
  text: string,
  opts: { messageId?: string } = {}
) {
  const messageId = opts.messageId ?? `E2E_TEST_${Date.now()}_${++msgCounter}`;

  const payload = {
    event: 'messages.upsert',
    instance: TEST.EVOLUTION_INSTANCE,
    data: {
      key: {
        remoteJid: `${TEST.PHONE}@s.whatsapp.net`,
        fromMe: false,
        id: messageId,
      },
      message: {
        conversation: text,
      },
      messageTimestamp: String(Math.floor(Date.now() / 1000)),
    },
  };

  const res = await request.post(`${TEST.BASE_URL}/api/whatsapp/webhook`, {
    data: payload,
  });

  return { status: res.status(), ok: res.ok() };
}
