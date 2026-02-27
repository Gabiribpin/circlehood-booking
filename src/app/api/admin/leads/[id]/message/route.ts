import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth: verificar cookie admin_session
  const cookieStore = await cookies();
  if (cookieStore.get('admin_session')?.value !== '1') {
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

  // Enviar via WhatsApp (Evolution API) usando a instância de vendas
  const evolutionApiUrl = process.env.EVOLUTION_API_URL;
  const evolutionApiKey = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE_SALES ?? 'circlehood-sales';

  if (evolutionApiUrl && evolutionApiKey) {
    try {
      await fetch(`${evolutionApiUrl}/message/sendText/${instance}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: evolutionApiKey,
        },
        body: JSON.stringify({ number: lead.phone, text: message.trim() }),
      });
    } catch (err) {
      console.error('[admin/leads/message] Failed to send WhatsApp:', err);
      // Não falha o request — mensagem já foi salva no DB
    }
  }

  return NextResponse.json({ success: true });
}
