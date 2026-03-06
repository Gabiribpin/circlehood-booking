import { logger } from '@/lib/logger';
/**
 * POST /api/webhooks/whatsapp-support
 *
 * Webhook from Evolution API — CircleHood's own WhatsApp instance.
 * Configure WHATSAPP_SUPPORT_INSTANCE in Evolution API to point here.
 *
 * Flow:
 *  1. Receives message from a SaaS customer (professional)
 *  2. Matches their phone to a professionals row
 *  3. AI bot generates a response
 *  4. If bot handles it → replies via WhatsApp
 *  5. If bot escalates → creates a support ticket + sends acknowledgment
 *
 * Required env vars:
 *   EVOLUTION_API_URL        — base URL of your Evolution API instance
 *   EVOLUTION_API_KEY        — Evolution API global key
 *   WHATSAPP_SUPPORT_INSTANCE — name of CircleHood's own Evolution instance
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { handleWhatsAppSupportMessage } from '@/lib/ai/support-bot';
import { validateEvolutionWebhook } from '@/lib/webhooks/signature';

async function sendWhatsAppReply(to: string, message: string) {
  const evoUrl = process.env.EVOLUTION_API_URL;
  const evoKey = process.env.EVOLUTION_API_KEY;
  const evoInstance = process.env.WHATSAPP_SUPPORT_INSTANCE;

  if (!evoUrl || !evoKey || !evoInstance) return;

  try {
    await fetch(`${evoUrl}/message/sendText/${evoInstance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: evoKey,
      },
      body: JSON.stringify({
        number: to,
        text: message,
      }),
    });
  } catch (err) {
    logger.error('[whatsapp-support] send error:', err);
  }
}

export async function POST(request: NextRequest) {
  // Validate Evolution API webhook signature
  const apikeyHeader = request.headers.get('apikey');
  if (!validateEvolutionWebhook(apikeyHeader, process.env.WHATSAPP_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Evolution API sends different event types — we only handle messages
  const event = body?.event ?? body?.type;
  if (event && !['messages.upsert', 'MESSAGES_UPSERT'].includes(event)) {
    return NextResponse.json({ received: true });
  }

  // Extract message data (Evolution API format)
  const data = body?.data ?? body;
  const key = data?.key ?? data?.message?.key;
  const fromMe = key?.fromMe ?? false;
  if (fromMe) return NextResponse.json({ received: true }); // ignore outgoing

  const remoteJid: string = key?.remoteJid ?? '';
  const messageText: string =
    data?.message?.conversation ??
    data?.message?.extendedTextMessage?.text ??
    data?.messageBody ??
    '';

  const pushName: string = data?.pushName ?? 'Cliente';

  if (!remoteJid || !messageText.trim()) {
    return NextResponse.json({ received: true });
  }

  // Normalize phone: strip @s.whatsapp.net and non-digits
  const phone = remoteJid.split('@')[0].replace(/\D/g, '');

  // Match to a professional by phone number
  const adminClient = createAdminClient();
  const { data: professional } = await adminClient
    .from('professionals')
    .select('id, business_name, phone, whatsapp')
    .or(`phone.ilike.%${phone}%,whatsapp.ilike.%${phone}%`)
    .limit(1)
    .maybeSingle();

  if (!professional) {
    // Unknown sender — send generic reply
    await sendWhatsAppReply(
      remoteJid,
      `Olá! 👋 Não reconhecemos sua conta CircleHood. Por favor, acesse ${process.env.NEXT_PUBLIC_BASE_URL ?? 'circlehood-booking.vercel.app'} para entrar em contato.`
    );
    return NextResponse.json({ received: true });
  }

  // Get AI response
  const result = await handleWhatsAppSupportMessage(messageText, pushName);

  // Send WhatsApp reply
  await sendWhatsAppReply(remoteJid, result.reply);

  // Create support ticket if bot escalated
  if (result.createTicket) {
    const { data: ticket } = await adminClient
      .from('support_tickets')
      .insert({
        professional_id: professional.id,
        subject: result.ticketSubject,
        message: messageText,
        status: 'in_progress',
        priority: 'medium',
        ai_escalated: true,
      })
      .select('id')
      .single();

    if (ticket) {
      // Add bot note as first reply
      await adminClient.from('ticket_replies').insert({
        ticket_id: ticket.id,
        author: 'bot',
        message: `📱 Chamado criado via WhatsApp (${remoteJid})`,
      });
    }
  }

  return NextResponse.json({ received: true });
}
