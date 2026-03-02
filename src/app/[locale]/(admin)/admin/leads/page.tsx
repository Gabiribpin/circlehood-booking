import { createAdminClient } from '@/lib/supabase/admin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LeadStatusBadge } from '@/components/admin/lead-status-badge';
import Link from 'next/link';
import { ArrowRight, Target } from 'lucide-react';

interface SearchParams {
  status?: string;
  search?: string;
}

export default async function AdminLeadsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { status, search } = await searchParams;
  const adminClient = createAdminClient();

  // Buscar todos os leads com a última mensagem
  let query = adminClient
    .from('sales_leads')
    .select('id, phone, name, email, status, source, assigned_to, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (status && status !== 'all') query = query.eq('status', status);

  const { data: leads } = await query;

  // Filtrar por busca (client-side — dataset pequeno)
  const filtered = (leads ?? []).filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.phone?.toLowerCase().includes(q) ||
      l.name?.toLowerCase().includes(q) ||
      l.email?.toLowerCase().includes(q)
    );
  });

  // Contadores
  const newCount       = (leads ?? []).filter((l) => l.status === 'new').length;
  const contactedCount = (leads ?? []).filter((l) => l.status === 'contacted').length;
  const qualifiedCount = (leads ?? []).filter((l) => l.status === 'qualified').length;
  const convertedCount = (leads ?? []).filter((l) => l.status === 'converted').length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Target className="h-6 w-6 text-indigo-500" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads de Vendas</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Gerencie e qualifique potenciais clientes do CircleHood Booking
          </p>
        </div>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-red-600">{newCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Novos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-yellow-600">{contactedCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Contactados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-blue-600">{qualifiedCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Qualificados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-green-600">{convertedCount}</p>
            <p className="text-xs text-muted-foreground mt-1">Convertidos</p>
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
          <option value="new">Novos</option>
          <option value="contacted">Contactados</option>
          <option value="qualified">Qualificados</option>
          <option value="converted">Convertidos</option>
          <option value="lost">Perdidos</option>
        </select>
        <input
          name="search"
          type="text"
          defaultValue={search ?? ''}
          placeholder="Buscar por nome, telefone ou email..."
          className="text-sm border rounded-md px-3 py-2 bg-background flex-1 min-w-0 w-full sm:w-auto"
        />
        <button
          type="submit"
          className="text-sm border rounded-md px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Filtrar
        </button>
        {(status || search) && (
          <a
            href="/admin/leads"
            className="text-sm text-muted-foreground hover:text-foreground px-2 py-2 transition-colors"
          >
            Limpar
          </a>
        )}
      </form>

      {/* Leads table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {filtered.length} lead{filtered.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum lead encontrado com esses filtros.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="text-left pb-3 font-medium">Telefone</th>
                    <th className="text-left pb-3 font-medium">Nome / Email</th>
                    <th className="text-left pb-3 font-medium">Status</th>
                    <th className="text-left pb-3 font-medium">Origem</th>
                    <th className="text-left pb-3 font-medium">Responsável</th>
                    <th className="text-left pb-3 font-medium">Atualizado</th>
                    <th className="pb-3" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((lead) => (
                    <tr key={lead.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 pr-4">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {lead.phone}
                        </code>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-medium">{lead.name ?? '—'}</p>
                        {lead.email && (
                          <p className="text-xs text-muted-foreground">{lead.email}</p>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <LeadStatusBadge status={lead.status} />
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground capitalize">
                        {lead.source}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {lead.assigned_to ?? '—'}
                      </td>
                      <td className="py-3 pr-4 text-muted-foreground text-xs whitespace-nowrap">
                        {new Date(lead.updated_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3">
                        <Link
                          href={`/admin/leads/${lead.id}`}
                          className="flex items-center gap-1 text-primary text-xs hover:underline"
                        >
                          Ver conversa <ArrowRight className="h-3 w-3" />
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
