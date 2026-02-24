import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendTicketReplyEmail } from '@/lib/resend';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Verify admin
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!user || !adminEmail || user.email !== adminEmail) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  const { message, newStatus } = await request.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: 'Mensagem obrigatória' }, { status: 400 });
  }

  const adminClient = createAdminClient();

  // Get ticket + professional info for email notification
  const { data: ticket } = await adminClient
    .from('support_tickets')
    .select(`
      id, subject, status,
      professionals (
        business_name,
        user_id,
        users:user_id (email)
      )
    `)
    .eq('id', id)
    .single();

  if (!ticket) return NextResponse.json({ error: 'Chamado não encontrado' }, { status: 404 });

  // Insert admin reply
  const { error: replyErr } = await adminClient.from('ticket_replies').insert({
    ticket_id: id,
    author: 'admin',
    message: message.trim(),
  });

  if (replyErr) {
    return NextResponse.json({ error: replyErr.message }, { status: 500 });
  }

  // Update status if provided
  const statusToSet = newStatus ?? (ticket.status === 'open' ? 'in_progress' : ticket.status);
  await adminClient
    .from('support_tickets')
    .update({ status: statusToSet })
    .eq('id', id);

  // Send email notification to professional
  const prof = ticket.professionals as any;
  const profEmail = prof?.users?.email ?? null;
  const profName = prof?.business_name ?? 'Profissional';

  if (profEmail) {
    ;(async () => {
      try {
        await sendTicketReplyEmail({
          professionalEmail: profEmail,
          professionalName: profName,
          ticketSubject: ticket.subject,
          replyMessage: message.trim(),
        });
      } catch (err) {
        console.error('[admin/support/reply] email error:', err);
      }
    })();
  }

  return NextResponse.json({ success: true, status: statusToSet });
}
