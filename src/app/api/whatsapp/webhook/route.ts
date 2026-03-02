import { NextRequest, NextResponse, after } from 'next/server';
import { processWhatsAppMessage } from '@/lib/whatsapp/processor';
import { isEvolutionPayload, isMetaPayload } from '@/lib/whatsapp/types';
import { parseEvolutionPhone, sendEvolutionMessage } from '@/lib/whatsapp/evolution';
import { createClient } from '@supabase/supabase-js';

const AUDIO_REPLY =
  'Desculpe, ainda não consigo ouvir áudios 🎙️ Por favor, envie sua mensagem por texto e ficarei feliz em ajudar! 😊';

async function getEvolutionConfig(instance: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data } = await supabase
    .from('whatsapp_config')
    .select('evolution_api_url, evolution_api_key, evolution_instance')
    .eq('evolution_instance', instance)
    .single();
  if (!data) return null;
  return {
    apiUrl: data.evolution_api_url,
    apiKey: data.evolution_api_key,
    instance: data.evolution_instance,
  };
}

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

const isNonProduction =
  process.env.VERCEL_ENV &&
  process.env.VERCEL_ENV !== 'production' &&
  process.env.NODE_ENV !== 'test';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ── Safety: não processar mensagens reais em staging/preview ──
    if (isNonProduction) {
      console.log(
        `[webhook] Ambiente ${process.env.VERCEL_ENV} — mensagem recebida mas NÃO processada`,
        JSON.stringify(body).slice(0, 200)
      );
      return NextResponse.json({
        status: 'ok',
        environment: process.env.VERCEL_ENV,
        sent: false,
      });
    }

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

      const isAudio =
        !!body.data.message?.audioMessage ||
        !!body.data.message?.pttMessage;

      const from = parseEvolutionPhone(body.data.key.remoteJid);
      const messageId = body.data.key.id;

      if (isAudio) {
        // Retornar 200 imediatamente; enviar resposta de áudio em background
        after(async () => {
          try {
            const config = await getEvolutionConfig(body.instance);
            if (config) {
              await sendEvolutionMessage(from, AUDIO_REPLY, config);
            }
          } catch (audioErr) {
            console.error('[webhook] Failed to send audio reply:', audioErr);
          }
        });
        return NextResponse.json({ status: 'ok' });
      }

      if (!text) {
        return NextResponse.json({ status: 'ok' });
      }

      // Retornar 200 ANTES de processar — evita retries da Evolution API
      // que causam loop de mensagens duplicadas quando o bot demora > 5s
      after(async () => {
        await processWhatsAppMessage(from, text, messageId, 'evolution', body.instance);
      });
      return NextResponse.json({ status: 'ok' });
    }

    // ── Formato Meta Business ──────────────────────────────────
    if (isMetaPayload(body)) {
      if (body.entry?.[0]?.changes?.[0]?.value?.messages) {
        const message = body.entry[0].changes[0].value.messages[0];
        const from = message.from;
        const text = message.text?.body;
        const messageId = message.id;

        // Ignore audio messages (no STT yet)
        if (message.type === 'audio' || message.type === 'voice') {
          return NextResponse.json({ status: 'ok' });
        }

        if (!text) {
          return NextResponse.json({ status: 'ok' });
        }

        after(async () => {
          await processWhatsAppMessage(from, text, messageId, 'meta');
        });
      }
      return NextResponse.json({ status: 'ok' });
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
