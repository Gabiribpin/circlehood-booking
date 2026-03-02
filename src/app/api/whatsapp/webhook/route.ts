import { NextRequest, NextResponse, after } from 'next/server';
import { processWhatsAppMessage } from '@/lib/whatsapp/processor';
import { isEvolutionPayload, isMetaPayload } from '@/lib/whatsapp/types';
import { parseEvolutionPhone, sendEvolutionMessage } from '@/lib/whatsapp/evolution';
import { validateEvolutionWebhook } from '@/lib/evolution/webhook-auth';
import { maskSensitiveHeaders } from '@/lib/evolution/mask-headers';
import { createClient } from '@supabase/supabase-js';

const AUDIO_REPLY =
  'Desculpe, ainda não consigo ouvir áudios 🎙️ Por favor, envie sua mensagem por texto e ficarei feliz em ajudar! 😊';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getEvolutionConfig(instance: string) {
  const { data } = await getSupabase()
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

/** Fire-and-forget webhook log insert (never blocks response). */
function logWebhook(
  instanceName: string,
  status: number,
  processingTimeMs: number,
  opts?: { error?: string; rateLimited?: boolean; metadata?: Record<string, unknown> }
) {
  getSupabase()
    .from('webhook_logs')
    .insert({
      instance_name: instanceName,
      status,
      processing_time_ms: processingTimeMs,
      error: opts?.error ?? null,
      rate_limited: opts?.rateLimited ?? false,
      metadata: opts?.metadata ?? null,
    } as never)
    .then(({ error }) => {
      if (error) console.error('[webhook-log] insert failed:', error.message);
    });
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

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();

    // ── Formato Evolution API ──────────────────────────────────
    if (isEvolutionPayload(body)) {
      // TODO: Remove after confirming exact Evolution header names (temporary debug logging)
      if (process.env.WEBHOOK_DEBUG_HEADERS === 'true') {
        const safeHeaders = maskSensitiveHeaders(request.headers);
        console.log(`[webhook-debug] Instance: ${body.instance} | Headers:`, safeHeaders);
      }

      // Validate webhook authenticity
      const isValid = await validateEvolutionWebhook(request.headers, body.instance);
      if (!isValid) {
        console.warn('[webhook] Invalid Evolution webhook request for instance:', body.instance);
        logWebhook(body.instance, 401, Date.now() - startTime, { error: 'Unauthorized' });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

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
      logWebhook(body.instance, 200, Date.now() - startTime, {
        metadata: { event: body.event, type: 'text' },
      });
      after(async () => {
        await processWhatsAppMessage(from, text, messageId, 'evolution', body.instance);
      });
      return NextResponse.json({ status: 'ok' });
    }

    // ── Formato Meta Business ──────────────────────────────────
    // Meta payloads are verified via the GET hub.verify_token handshake at setup time.
    // For additional security in production, validate X-Hub-Signature-256 header.
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
    logWebhook('unknown', 500, Date.now() - startTime, {
      error: (error as Error).message,
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
