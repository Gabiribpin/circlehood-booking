import { createAdminClient } from '@/lib/supabase/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

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

interface SearchParams {
  status?: string;
  priority?: string;
  search?: string;
}

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { status, priority, search } = await searchParams;
  const adminClient = createAdminClient();

  // Build query
  let query = adminClient
    .from('support_tickets')
    .select(`
      id, subject, status, priority, ai_escalated, created_at, updated_at,
      professionals (
        business_name
      )
    `)
    .order('updated_at', { ascending: false });

  if (status && status !== 'all') query = query.eq('status', status);
  if (priority && priority !== 'all') query = query.eq('priority', priority);

  const { data: tickets } = await query;

  // Client-side search filter (small dataset)
  const filtered = search
    ? (tickets ?? []).filter(
        (t) =>
          t.subject.toLowerCase().includes(search.toLowerCase()) ||
          (t.professionals as any)?.business_name?.toLowerCase().includes(search.toLowerCase())
      )
    : (tickets ?? []);

  // Stats
  const openCount = (tickets ?? []).filter((t) => t.status === 'open').length;
  const inProgressCount = (tickets ?? []).filter((t) => t.status === 'in_progress').length;
  const escalatedCount = (tickets ?? []).filter((t) => t.ai_escalated && t.status !== 'resolved').length;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Central de Chamados</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie os chamados de suporte dos clientes do CircleHood Booking
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-red-600">{openCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Abertos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-yellow-600">{inProgressCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Em andamento</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{escalatedCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Escalados pelo bot</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-3">
        <select
          name="status"
          defaultValue={status ?? 'all'}
          className="text-sm border rounded-md px-3 py-2 bg-background"
        >
          <option value="all">Todos os status</option>
          <option value="open">Abertos</option>
          <option value="in_progress">Em andamento</option>
          <option value="resolved">Resolvidos</option>
        </select>
        <select
          name="priority"
          defaultValue={priority ?? 'all'}
          className="text-sm border rounded-md px-3 py-2 bg-background"
        >
          <option value="all">Todas as prioridades</option>
          <option value="high">Alta</option>
          <option value="medium">Média</option>
          <option value="low">Baixa</option>
        </select>
        <input
          name="search"
          type="text"
          defaultValue={search ?? ''}
          placeholder="Buscar por cliente ou assunto..."
          className="text-sm border rounded-md px-3 py-2 bg-background flex-1 min-w-[200px]"
        />
        <button
          type="submit"
          className="text-sm border rounded-md px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Filtrar
        </button>
        {(status || priority || search) && (
          <a
            href="/admin/support"
            className="text-sm text-muted-foreground hover:text-foreground px-2 py-2 transition-colors"
          >
            Limpar
          </a>
        )}
      </form>

      {/* Tickets table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {filtered.length} chamado{filtered.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum chamado encontrado com esses filtros.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="text-left pb-3 font-medium">Cliente</th>
                    <th className="text-left pb-3 font-medium">Assunto</th>
                    <th className="text-left pb-3 font-medium">Status</th>
                    <th className="text-left pb-3 font-medium">Prioridade</th>
                    <th className="text-left pb-3 font-medium">Atualizado</th>
                    <th className="pb-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 pr-4">
                        <p className="font-medium">
                          {(ticket.professionals as any)?.business_name ?? '—'}
                        </p>
                        {ticket.ai_escalated && ticket.status !== 'resolved' && (
                          <span className="text-[10px] text-blue-600">🔁 Escalado pelo bot</span>
                        )}
                      </td>
                      <td className="py-3 pr-4 max-w-[280px]">
                        <p className="truncate">{ticket.subject}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={STATUS_VARIANT[ticket.status]} className="text-xs">
                          {STATUS_LABELS[ticket.status]}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {PRIORITY_LABELS[ticket.priority]}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground text-xs whitespace-nowrap">
                        {new Date(ticket.updated_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3">
                        <Link
                          href={`/admin/support/${ticket.id}`}
                          className="flex items-center gap-1 text-primary text-xs hover:underline"
                        >
                          Responder <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
