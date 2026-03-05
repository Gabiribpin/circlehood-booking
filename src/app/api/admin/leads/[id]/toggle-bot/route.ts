import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateAdminToken } from '@/lib/admin/session';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const cookieStore = await cookies();
  if (!(await validateAdminToken(cookieStore.get('admin_session')?.value))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: leadId } = await params;
  const body = await request.json();
  const { conversationId, botActive } = body;

  if (!conversationId || typeof botActive !== 'boolean') {
    return NextResponse.json({ error: 'conversationId e botActive são obrigatórios' }, { status: 400 });
  }

  const adminClient = createAdminClient();

  // Verificar que a conversa pertence ao lead
  const { data: conv } = await adminClient
    .from('sales_conversations')
    .select('id, lead_id')
    .eq('id', conversationId)
    .eq('lead_id', leadId)
    .single();

  if (!conv) {
    return NextResponse.json({ error: 'Conversa não encontrada' }, { status: 404 });
  }

  await adminClient
    .from('sales_conversations')
    .update({ bot_active: botActive, updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  return NextResponse.json({ success: true, botActive });
  } catch (err) {
    logger.error('[admin/leads/toggle-bot]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
