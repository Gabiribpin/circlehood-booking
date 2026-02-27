import { createAdminClient } from '@/lib/supabase/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Bot, Shield, User, ArrowLeft, Target } from 'lucide-react';
import { LeadStatusBadge } from '@/components/admin/lead-status-badge';
import { LeadActionsForm } from '@/components/admin/lead-actions-form';

export default async function AdminLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const adminClient = createAdminClient();

  // Fetch lead
  const { data: lead } = await adminClient
    .from('sales_leads')
    .select('id, phone, name, email, status, source, notes, assigned_to, created_at, updated_at')
    .eq('id', id)
    .single();

  if (!lead) notFound();

  // Fetch active conversation
  const { data: conversation } = await adminClient
    .from('sales_conversations')
    .select('id, channel, bot_active, is_active')
    .eq('lead_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch messages
  const messages = conversation
    ? (
        await adminClient
          .from('sales_messages')
          .select('id, direction, author, content, created_at')
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: true })
      ).data ?? []
    : [];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Back link */}
      <Link
        href="/admin/leads"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar aos leads
      </Link>

      {/* Lead header */}
      <div>
        <div className="flex items-start gap-3 flex-wrap mb-2">
          <LeadStatusBadge status={lead.status} />
          {conversation?.bot_active === false && (
            <span className="text-xs bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-700 rounded-full px-2 py-0.5">
              🛡️ Admin assumiu
            </span>
          )}
        </div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Target className="h-5 w-5 text-indigo-500" />
          {lead.name ?? lead.phone}
        </h1>
        <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
          <span>
            <strong>Telefone:</strong>{' '}
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{lead.phone}</code>
          </span>
          {lead.email && (
            <span>
              <strong>Email:</strong>{' '}
              <a href={`mailto:${lead.email}`} className="hover:underline text-primary">
                {lead.email}
              </a>
            </span>
          )}
          <span>
            <strong>Origem:</strong> <span className="capitalize">{lead.source}</span>
          </span>
          {lead.assigned_to && (
            <span>
              <strong>Responsável:</strong> {lead.assigned_to}
            </span>
          )}
          <span>
            <strong>Criado:</strong>{' '}
            {new Date(lead.created_at).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
        {lead.notes && (
          <p className="mt-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            📝 {lead.notes}
          </p>
        )}
      </div>

      {/* Conversation thread */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Conversa
            {conversation && (
              <span className="ml-2 text-xs font-normal text-muted-foreground capitalize">
                via {conversation.channel}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma mensagem ainda.
            </p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.author === 'admin' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white ${
                  msg.author === 'bot'
                    ? 'bg-blue-500'
                    : msg.author === 'admin'
                      ? 'bg-slate-700'
                      : 'bg-indigo-500'
                }`}
              >
                {msg.author === 'bot' ? (
                  <Bot className="h-4 w-4" />
                ) : msg.author === 'admin' ? (
                  <Shield className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </div>
              <div
                className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                  msg.author === 'admin'
                    ? 'bg-slate-800 text-slate-100 rounded-tr-sm'
                    : msg.author === 'bot'
                      ? 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-tl-sm'
                      : 'bg-muted/50 rounded-tl-sm'
                }`}
              >
                <p className="text-xs font-medium opacity-60 mb-1">
                  {msg.author === 'bot'
                    ? '🤖 Bot de vendas'
                    : msg.author === 'admin'
                      ? '🛡️ Equipe CircleHood'
                      : lead.name ?? lead.phone}
                  {' · '}
                  {new Date(msg.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Actions form */}
      {lead.status !== 'converted' && lead.status !== 'lost' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ações</CardTitle>
          </CardHeader>
          <CardContent>
            {conversation ? (
              <LeadActionsForm
                leadId={lead.id}
                conversationId={conversation.id}
                currentStatus={lead.status}
                botActive={conversation.bot_active ?? true}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhuma conversa ativa para este lead.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card
          className={
            lead.status === 'converted'
              ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
              : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700'
          }
        >
          <CardContent className="p-4 text-center">
            <p
              className={`text-sm ${
                lead.status === 'converted'
                  ? 'text-green-700 dark:text-green-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {lead.status === 'converted'
                ? '✅ Lead convertido em cliente'
                : '❌ Lead marcado como perdido'}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
