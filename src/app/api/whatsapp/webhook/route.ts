import { NextRequest, NextResponse } from 'next/server';
import { processWhatsAppMessage } from '@/lib/whatsapp/processor';
import { isEvolutionPayload, isMetaPayload } from '@/lib/whatsapp/types';
import { parseEvolutionPhone } from '@/lib/whatsapp/evolution';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  // Verificação do webhook Meta Business (setup inicial)
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge);
  }

  // Evolution API também pode fazer GET para verificar se o webhook está ativo
  return new NextResponse('OK', { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ── Formato Evolution API ──────────────────────────────────
    if (isEvolutionPayload(body)) {
      // Ignorar mensagens enviadas pelo próprio bot
      if (body.data.key.fromMe) {
        return NextResponse.json({ status: 'ok' });
      }

      // Ignorar eventos que não sejam de mensagem recebida
      if (body.event !== 'messages.upsert') {
        return NextResponse.json({ status: 'ok' });
      }

      const text =
        body.data.message?.conversation ||
        body.data.message?.extendedTextMessage?.text;

      if (!text) {
        return NextResponse.json({ status: 'ok' });
      }

      const from = parseEvolutionPhone(body.data.key.remoteJid);
      const messageId = body.data.key.id;

      await processWhatsAppMessage(from, text, messageId, 'evolution', body.instance);
      return NextResponse.json({ status: 'ok' });
    }

    // ── Formato Meta Business ──────────────────────────────────
    if (isMetaPayload(body)) {
      if (body.entry?.[0]?.changes?.[0]?.value?.messages) {
        const message = body.entry[0].changes[0].value.messages[0];
        const from = message.from;
        const text = message.text?.body;
        const messageId = message.id;

        if (!text) {
          return NextResponse.json({ status: 'ok' });
        }

        await processWhatsAppMessage(from, text, messageId, 'meta');
      }
      return NextResponse.json({ status: 'ok' });
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
