import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { validateAdminToken } from '@/lib/admin/session';
import { createAdminClient } from '@/lib/supabase/admin';

// PATCH — admin updates ticket status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const cookieStore = await cookies();
  if (!(await validateAdminToken(cookieStore.get('admin_session')?.value))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { status, priority } = await request.json();

  const VALID_STATUSES = ['open', 'in_progress', 'closed', 'awaiting_response'] as const;
  const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

  if (status && !(VALID_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
  }
  if (priority && !(VALID_PRIORITIES as readonly string[]).includes(priority)) {
    return NextResponse.json({ error: 'Prioridade inválida' }, { status: 400 });
  }

  const updates: Record<string, string> = {};
  if (status) updates.status = status;
  if (priority) updates.priority = priority;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from('support_tickets')
    .update(updates)
    .eq('id', id);

  if (error) return NextResponse.json({ error: 'Internal server error' }, { status: 500 });

  return NextResponse.json({ success: true });
}
