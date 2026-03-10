import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateSupportResponse } from '@/lib/ai/support-bot';
import { z } from 'zod';

const MAX_BODY_SIZE = 1_048_576; // 1 MB

const replySchema = z.object({
  message: z.string().min(1, 'Mensagem obrigatória').max(10000),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const contentLength = parseInt(request.headers.get('content-length') ?? '0', 10);
  if (contentLength > MAX_BODY_SIZE) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await request.json();
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  }
  const { message } = parsed.data;

  // Verify ticket ownership via RLS (only the owner can select it)
  const { data: ticket } = await supabase
    .from('support_tickets')
    .select('id, status, subject, message, ai_escalated')
    .eq('id', id)
    .single();

  if (!ticket) return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 });

  // Insert reply (RLS allows if ticket belongs to this professional)
  const { error } = await supabase.from('ticket_replies').insert({
    ticket_id: id,
    author: 'client',
    message: message.trim(),
  });

  if (error) return NextResponse.json({ error: 'Internal server error' }, { status: 500 });

  // Update status to in_progress if was still open
  if (ticket.status === 'open') {
    await supabase
      .from('support_tickets')
      .update({ status: 'in_progress' })
      .eq('id', id);
  }

  // AI auto-response on follow-up (async — does not block response to user)
  // Skip if ticket was already escalated to human support
  if (!ticket.ai_escalated) {
    const adminClient = createAdminClient();

    ;(async () => {
      try {
        // Fetch full conversation history for context
        const { data: allReplies } = await adminClient
          .from('ticket_replies')
          .select('author, message')
          .eq('ticket_id', id)
          .order('created_at', { ascending: true });

        const botResponse = await generateSupportResponse(
          ticket.subject,
          ticket.message,
          allReplies ?? []
        );

        await adminClient.from('ticket_replies').insert({
          ticket_id: id,
          author: 'bot',
          message: botResponse.message,
        });

        if (botResponse.shouldEscalate) {
          await adminClient
            .from('support_tickets')
            .update({ ai_escalated: true, status: 'in_progress' })
            .eq('id', id);
        }
      } catch (err) {
        logger.error('[support/tickets/reply] bot response error:', err);
      }
    })();
  }

  return NextResponse.json({ success: true });
}
