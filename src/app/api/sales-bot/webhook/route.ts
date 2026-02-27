/**
 * Sales Bot Webhook — Evolution API → Claude Sales Bot
 *
 * Fluxo:
 *  1. Recebe mensagem WhatsApp do lead via Evolution API
 *  2. Cria/atualiza lead em sales_leads
 *  3. Registra mensagem em sales_messages
 *  4. Se bot_active=true → chama Claude para gerar resposta
 *  5. Envia resposta via Evolution API e salva no DB
 */
import { NextRequest, NextResponse, after } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

const SALES_SYSTEM_PROMPT = `Você é um assistente de vendas do CircleHood Booking — uma plataforma SaaS de agendamento para profissionais independentes (cabeleireiros, personal trainers, coaches, etc.).

Seu objetivo é qualificar leads que entraram em contato via WhatsApp e guiá-los para criar uma conta gratuita ou assinar o plano profissional.

Informações do produto:
- Plataforma de agendamento online com página pública personalizada
- Bot de WhatsApp com IA para responder clientes automaticamente
- Plano gratuito disponível para começar (até X agendamentos/mês)
- Plano Pro com recursos ilimitados (pagamento via Stripe)

Como agir:
1. Cumprimente de forma amigável e profissional
2. Pergunte sobre o tipo de negócio e principais dores do cliente
3. Apresente como o CircleHood resolve esses problemas
4. Convide para criar uma conta gratuita em booking.circlehood-tech.com/register
5. Se tiver interesse no Pro, explique os benefícios e direcione para o plano

Seja conciso (máx. 3 parágrafos), use linguagem natural e amigável. Nunca invente preços — diga que os planos detalhados estão no site.`;

function createSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function createAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

/** Retorna ou cria um lead pelo telefone */
async function upsertLead(supabase: ReturnType<typeof createSupabase>, phone: string) {
  const { data: existing } = await supabase
    .from('sales_leads')
    .select('id, status, name')
    .eq('phone', phone)
    .maybeSingle();

  if (existing) return existing;

  const { data: created } = await supabase
    .from('sales_leads')
    .insert({ phone, status: 'new', source: 'whatsapp' })
    .select('id, status, name')
    .single();

  return created;
}

/** Retorna ou cria conversa ativa para o lead */
async function upsertConversation(supabase: ReturnType<typeof createSupabase>, leadId: string) {
  const { data: existing } = await supabase
    .from('sales_conversations')
    .select('id, bot_active')
    .eq('lead_id', leadId)
    .eq('channel', 'whatsapp')
    .maybeSingle();

  if (existing) return existing;

  const { data: created } = await supabase
    .from('sales_conversations')
    .insert({ lead_id: leadId, channel: 'whatsapp', bot_active: true })
    .select('id, bot_active')
    .single();

  return created;
}

/** Busca histórico recente da conversa (últimas 20 mensagens) */
async function getRecentMessages(supabase: ReturnType<typeof createSupabase>, conversationId: string) {
  const { data } = await supabase
    .from('sales_messages')
    .select('author, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(20);

  return (data ?? []).reverse();
}

/** Envia mensagem via Evolution API */
async function sendWhatsApp(phone: string, text: string) {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE_SALES ?? 'circlehood-sales';

  if (!apiUrl || !apiKey) return;

  await fetch(`${apiUrl}/message/sendText/${instance}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: apiKey },
    body: JSON.stringify({ number: phone, text }),
  });
}

async function processSalesMessage(phone: string, userText: string) {
  const supabase = createSupabase();

  // Upsert lead + conversa
  const lead = await upsertLead(supabase, phone);
  if (!lead) return;

  const conv = await upsertConversation(supabase, lead.id);
  if (!conv) return;

  // Salvar mensagem recebida
  await supabase.from('sales_messages').insert({
    conversation_id: conv.id,
    direction: 'inbound',
    author: 'lead',
    content: userText,
  });

  // Atualizar timestamp do lead
  await supabase
    .from('sales_leads')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', lead.id);

  // Se bot inativo (admin assumiu), não responder
  if (!conv.bot_active) return;

  // Buscar histórico para contexto
  const history = await getRecentMessages(supabase, conv.id);

  // Montar messages para Claude (excluindo a última — já é o userText)
  const claudeMessages: Anthropic.MessageParam[] = history
    .slice(0, -1) // excluir última (userText recém inserido)
    .map((m) => ({
      role: (m.author === 'lead' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.content,
    }));

  // Garantir que começa com user e alterna corretamente
  // Se history tiver só a msg atual, claudeMessages é []
  claudeMessages.push({ role: 'user', content: userText });

  // Chamar Claude
  const anthropic = createAnthropic();
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    system: SALES_SYSTEM_PROMPT,
    messages: claudeMessages,
  });

  const botReply = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as Anthropic.TextBlock).text)
    .join('');

  if (!botReply) return;

  // Salvar resposta do bot
  await supabase.from('sales_messages').insert({
    conversation_id: conv.id,
    direction: 'outbound',
    author: 'bot',
    content: botReply,
  });

  // Enviar via WhatsApp
  await sendWhatsApp(phone, botReply);

  // Se lead ainda era "new", marcar como "contacted"
  if (lead.status === 'new') {
    await supabase
      .from('sales_leads')
      .update({ status: 'contacted', updated_at: new Date().toISOString() })
      .eq('id', lead.id);
  }
}

export async function GET() {
  return new NextResponse('OK', { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Verificar formato Evolution API
    if (body.event !== 'messages.upsert') {
      return NextResponse.json({ status: 'ok' });
    }

    // Ignorar mensagens enviadas pelo bot
    if (body.data?.key?.fromMe) {
      return NextResponse.json({ status: 'ok' });
    }

    const text =
      body.data?.message?.conversation ||
      body.data?.message?.extendedTextMessage?.text;

    if (!text) {
      return NextResponse.json({ status: 'ok' });
    }

    const phone = (body.data?.key?.remoteJid ?? '').replace('@s.whatsapp.net', '');
    if (!phone) {
      return NextResponse.json({ status: 'ok' });
    }

    // Retornar 200 imediatamente; processar em background
    after(async () => {
      try {
        await processSalesMessage(phone, text);
      } catch (err) {
        console.error('[sales-bot/webhook] Error processing message:', err);
      }
    });

    return NextResponse.json({ status: 'ok' });
  } catch {
    return NextResponse.json({ status: 'ok' });
  }
}
