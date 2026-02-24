import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Verify ticket ownership via RLS (will return null if not owner)
  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('id')
    .eq('id', id)
    .single();

  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: replies } = await supabase
    .from('ticket_replies')
    .select('id, author, message, created_at')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true });

  return NextResponse.json({ replies: replies ?? [] });
}
