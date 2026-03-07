import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateSupportResponse } from '@/lib/ai/support-bot';

// ─── GET — list professional's own tickets ────────────────────────────────────
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: professional } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!professional) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: tickets } = await supabase
    .from('support_tickets')
    .select('id, ticket_number, subject, status, priority, ai_escalated, created_at, updated_at')
    .eq('professional_id', professional.id)
    .order('updated_at', { ascending: false });

  return NextResponse.json({ tickets: tickets ?? [] });
}

// ─── POST — create new ticket + AI bot auto-response ──────────────────────────
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: professional } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!professional) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json();
  const { subject, message, priority: rawPriority = 'medium' } = body;

  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'Assunto e mensagem são obrigatórios' }, { status: 400 });
  }

  const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
  const priority = VALID_PRIORITIES.includes(rawPriority) ? rawPriority : 'medium';

  // Create ticket with admin client (bypasses RLS for insert)
  const adminClient = createAdminClient();
  const { data: ticket, error } = await adminClient
    .from('support_tickets')
    .insert({
      professional_id: professional.id,
      subject: subject.trim(),
      message: message.trim(),
      priority,
    })
    .select('id')
    .single();

  if (error || !ticket) {
    logger.error('[support/tickets] insert error:', error);
    return NextResponse.json({ error: 'Falha ao criar chamado' }, { status: 500 });
  }

  // AI auto-response (async — does not block response to user)
  ;(async () => {
    try {
      const botResponse = await generateSupportResponse(subject, message);

      await adminClient.from('ticket_replies').insert({
        ticket_id: ticket.id,
        author: 'bot',
        message: botResponse.message,
      });

      if (botResponse.shouldEscalate) {
        await adminClient
          .from('support_tickets')
          .update({ ai_escalated: true, status: 'in_progress' })
          .eq('id', ticket.id);
      }
    } catch (err) {
      logger.error('[support/tickets] bot response error:', err);
    }
  })();

  return NextResponse.json({ ticket: { id: ticket.id } }, { status: 201 });
}
