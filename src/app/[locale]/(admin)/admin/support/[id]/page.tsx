import { createAdminClient } from '@/lib/supabase/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Bot, Shield, User, ArrowLeft } from 'lucide-react';
import { TicketReplyForm } from '@/components/admin/ticket-reply-form';

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberto',
  in_progress: 'Em andamento',
  resolved: 'Resolvido',
};
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  open: 'destructive',
  in_progress: 'secondary',
  resolved: 'outline',
};
const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
};

export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const adminClient = createAdminClient();

  // Fetch ticket with professional info
  const { data: ticket } = await adminClient
    .from('support_tickets')
    .select(`
      id, ticket_number, subject, message, status, priority, ai_escalated, created_at, updated_at,
      professionals (
        id, business_name, account_number, user_id
      )
    `)
    .eq('id', id)
    .single();

  if (!ticket) notFound();

  // Fetch email separately — auth.users is not joinable via PostgREST
  let profEmail: string | null = null;
  const prof = ticket.professionals as any;
  if (prof?.user_id) {
    const { data: userData } = await adminClient.auth.admin.getUserById(prof.user_id);
    profEmail = userData?.user?.email ?? null;
  }

  // Fetch replies
  const { data: replies } = await adminClient
    .from('ticket_replies')
    .select('id, author, message, created_at')
    .eq('ticket_id', id)
    .order('created_at', { ascending: true });

  // prof already set above

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Back link */}
      <Link
        href="/admin/support"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar aos chamados
      </Link>

      {/* Ticket header */}
      <div>
        <div className="flex items-start gap-3 flex-wrap mb-2">
          <Badge variant={STATUS_VARIANT[ticket.status]}>
            {STATUS_LABELS[ticket.status]}
          </Badge>
          <Badge variant="outline">Prioridade {PRIORITY_LABELS[ticket.priority]}</Badge>
          {ticket.ai_escalated && (
            <Badge variant="secondary">🔁 Escalado pelo bot</Badge>
          )}
        </div>
        <h1 className="text-xl font-bold">{ticket.subject}</h1>
        <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
          {(ticket as any).ticket_number && (
            <span>
              <strong>Ticket:</strong>{' '}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                {(ticket as any).ticket_number}
              </code>
            </span>
          )}
          {prof?.account_number && (
            <span>
              <strong>Account:</strong>{' '}
              <code className="text-xs bg-muted px-1 py-0.5 rounded">
                {prof.account_number}
              </code>
            </span>
          )}
          <span>
            <strong>Cliente:</strong> {prof?.business_name ?? '—'}
          </span>
          {profEmail && (
            <span>
              <strong>Email:</strong>{' '}
              <a href={`mailto:${profEmail}`} className="hover:underline text-primary">
                {profEmail}
              </a>
            </span>
          )}
          <span>
            <strong>Criado:</strong>{' '}
            {new Date(ticket.created_at).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>

      {/* Conversation thread */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Original message */}
          <div className="flex gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <User className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="flex-1 bg-muted/50 rounded-xl rounded-tl-sm px-4 py-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                {prof?.business_name ?? 'Cliente'} · {new Date(ticket.created_at).toLocaleDateString('pt-BR')}
              </p>
              <p className="text-sm whitespace-pre-wrap">{ticket.message}</p>
            </div>
          </div>

          {/* Replies */}
          {(replies ?? []).map((reply) => (
            <div
              key={reply.id}
              className={`flex gap-3 ${reply.author === 'admin' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white ${
                  reply.author === 'bot'
                    ? 'bg-blue-500'
                    : reply.author === 'admin'
                      ? 'bg-slate-700'
                      : 'bg-primary'
                }`}
              >
                {reply.author === 'bot' ? (
                  <Bot className="h-4 w-4" />
                ) : reply.author === 'admin' ? (
                  <Shield className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </div>
              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                  reply.author === 'admin'
                    ? 'bg-slate-800 text-slate-100 rounded-tr-sm'
                    : reply.author === 'bot'
                      ? 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-tl-sm'
                      : 'bg-muted/50 rounded-tl-sm'
                }`}
              >
                <p className="text-xs font-medium opacity-60 mb-1">
                  {reply.author === 'bot'
                    ? '🤖 Bot de suporte'
                    : reply.author === 'admin'
                      ? '🛡️ Equipe CircleHood'
                      : prof?.business_name ?? 'Cliente'}
                  {' · '}
                  {new Date(reply.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <p className="whitespace-pre-wrap leading-relaxed">{reply.message}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Reply form */}
      {ticket.status !== 'resolved' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Responder</CardTitle>
          </CardHeader>
          <CardContent>
            <TicketReplyForm
              ticketId={ticket.id}
              currentStatus={ticket.status}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
          <CardContent className="p-4 text-center">
            <p className="text-green-700 dark:text-green-400 text-sm">
              ✅ Chamado marcado como resolvido
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
