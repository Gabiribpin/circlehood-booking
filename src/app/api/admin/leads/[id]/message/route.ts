import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateAdminToken } from '@/lib/admin/session';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth: verificar cookie admin_session
  const cookieStore = await cookies();
  if (!(await validateAdminToken(cookieStore.get('admin_session')?.value))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: leadId } = await params;
  const body = await request.json();
  const { conversationId, message, newStatus } = body;

  if (!conversationId || !message?.trim()) {
    return NextResponse.json({ error: 'conversationId e message são obrigatórios' }, { status: 400 });
  }

  const adminClient = createAdminClient();

  // Verificar que o lead existe
  const { data: lead } = await adminClient
    .from('sales_leads')
    .select('id, phone, status')
    .eq('id', leadId)
    .single();

  if (!lead) {
    return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
  }

  // Inserir mensagem na thread
  await adminClient.from('sales_messages').insert({
    conversation_id: conversationId,
    direction: 'outbound',
    author: 'admin',
    content: message.trim(),
  });

  // Atualizar status do lead se fornecido
  if (newStatus && newStatus !== lead.status) {
    await adminClient
      .from('sales_leads')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
        ...(newStatus === 'converted' ? { converted_at: new Date().toISOString() } : {}),
      })
      .eq('id', leadId);
  }

  // Atualizar updated_at da conversa
  await adminClient
    .from('sales_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  // Enviar via WhatsApp — busca credenciais Evolution API do banco
  const salesInstance = process.env.EVOLUTION_INSTANCE_SALES ?? 'circlehood-sales';

  // Tenta match exato pela instância de vendas; fallback para qualquer config ativa
  const { data: evoExact } = await adminClient
    .from('whatsapp_config')
    .select('evolution_api_url, evolution_api_key')
    .eq('evolution_instance', salesInstance)
    .maybeSingle();

  const evoConfig = evoExact ?? (await adminClient
    .from('whatsapp_config')
    .select('evolution_api_url, evolution_api_key')
    .not('evolution_api_url', 'is', null)
    .not('evolution_api_key', 'is', null)
    .limit(1)
    .maybeSingle()
  ).data;

  if (evoConfig?.evolution_api_url && evoConfig?.evolution_api_key) {
    try {
      await fetch(`${evoConfig.evolution_api_url}/message/sendText/${salesInstance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: evoConfig.evolution_api_key,
        },
        body: JSON.stringify({ number: lead.phone, text: message.trim() }),
      });
    } catch (err) {
      logger.error('[admin/leads/message] Failed to send WhatsApp:', err);
      // Não falha o request — mensagem já foi salva no DB
    }
  } else {
    logger.warn('[admin/leads/message] No Evolution API config found in database');
  }

  return NextResponse.json({ success: true });
}
