import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { message } = await request.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: 'Mensagem obrigatória' }, { status: 400 });
  }

  // Verify ticket ownership via RLS (only the owner can select it)
  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('id, status')
    .eq('id', id)
    .single();

  if (!ticket) return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 });

  // Insert reply (RLS allows if ticket belongs to this professional)
  const { error } = await supabase.from('ticket_replies').insert({
    ticket_id: id,
    author: 'client',
    message: message.trim(),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Update status to in_progress if was still open
  if (ticket.status === 'open') {
    await supabase
      .from('support_tickets')
      .update({ status: 'in_progress' })
      .eq('id', id);
  }

  return NextResponse.json({ success: true });
}
