import { createAdminClient } from '@/lib/supabase/admin';
import { getStripe } from '@/lib/stripe';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SubscriberChart, type ChartDataPoint } from '@/components/admin/subscriber-chart';
import { SystemHealthMetrics } from '@/components/admin/system-health-metrics';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  TrendingUp,
  DollarSign,
  UserCheck,
  UserX,
  Hourglass,
} from 'lucide-react';

// ─── helpers ────────────────────────────────────────────────────────────────

function buildGrowthChart(
  professionals: Array<{ created_at: string; subscription_status: string }>
): ChartDataPoint[] {
  const now = new Date();
  const months: Record<string, { registrations: number; converted: number }> = {};

  // Initialise last 12 months
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    months[key] = { registrations: 0, converted: 0 };
  }

  professionals.forEach((p) => {
    const d = new Date(p.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (key in months) {
      months[key].registrations++;
      if (p.subscription_status === 'active') {
        months[key].converted++;
      }
    }
  });

  let cumulative = 0;
  return Object.entries(months).map(([key, v]) => {
    cumulative += v.registrations;
    const [year, month] = key.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    const label = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    return { label, registrations: v.registrations, converted: v.converted, cumulative };
  });
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount);
}

// ─── page ────────────────────────────────────────────────────────────────────

export default async function AdminDashboardPage() {
  const supabase = createAdminClient();
  const stripe = getStripe();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // ── Supabase data ──────────────────────────────────────────────────────────
  const { data: professionals } = await supabase
    .from('professionals')
    .select('id, business_name, created_at, subscription_status, trial_ends_at, stripe_customer_id')
    .order('created_at', { ascending: true });

  const all = professionals ?? [];
  const total = all.length;
  const active = all.filter((p) => p.subscription_status === 'active').length;
  const onTrial = all.filter(
    (p) => p.subscription_status === 'trial' && new Date(p.trial_ends_at) > now
  ).length;
  const churned = all.filter((p) =>
    ['cancelled', 'expired'].includes(p.subscription_status)
  ).length;

  // Conversion = active / (active + churned) — users who made a decision
  const decisionMade = active + churned;
  const conversionRate = decisionMade > 0 ? ((active / decisionMade) * 100).toFixed(1) : '—';

  // Recent signups (last 5)
  const recentSignups = [...all]
    .reverse()
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      name: p.business_name,
      status: p.subscription_status,
      createdAt: new Date(p.created_at).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
    }));

  // ── Stripe data ────────────────────────────────────────────────────────────
  let monthlyRevenue = 0;
  let revenueCurrency = 'EUR';
  let stripeError: string | null = null;

  try {
    if (!stripe) throw new Error('Stripe not configured');
    const invoices = await stripe.invoices.list({
      created: { gte: Math.floor(startOfMonth.getTime() / 1000) },
      status: 'paid',
      limit: 100,
    });

    for (const inv of invoices.data) {
      monthlyRevenue += inv.amount_paid ?? 0;
      if (inv.currency) revenueCurrency = inv.currency;
    }
    monthlyRevenue = monthlyRevenue / 100;
  } catch (err: any) {
    stripeError = err?.message ?? 'Erro ao conectar ao Stripe';
  }

  // ── Chart data ─────────────────────────────────────────────────────────────
  const chartData = buildGrowthChart(all);

  // ─── Status badge ────────────────────────────────────────────────────────
  function statusBadge(status: string) {
    const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      active: { label: 'Ativo', variant: 'default' },
      trial: { label: 'Teste', variant: 'secondary' },
      cancelled: { label: 'Cancelado', variant: 'destructive' },
      expired: { label: 'Expirado', variant: 'destructive' },
    };
    const s = map[status] ?? { label: status, variant: 'outline' };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard de Vendas</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Visão geral das assinaturas e receita do CircleHood Booking
        </p>
        {stripeError && (
          <div className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            ⚠️ Stripe: {stripeError}
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                <Users className="h-5 w-5 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total cadastros</p>
                <p className="text-3xl font-bold">{total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Plano ativo (Pro)</p>
                <p className="text-3xl font-bold text-green-600">{active}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Hourglass className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Em período de teste</p>
                <p className="text-3xl font-bold text-blue-600">{onTrial}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <UserX className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cancelados / Expirados</p>
                <p className="text-3xl font-bold text-red-500">{churned}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                <TrendingUp className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Taxa de conversão</p>
                <p className="text-3xl font-bold text-indigo-600">{conversionRate}%</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Teste → Pro</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Receita do mês</p>
                <p className="text-2xl font-bold text-amber-600">
                  {stripeError
                    ? '—'
                    : formatCurrency(monthlyRevenue, revenueCurrency)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Growth chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evolução de assinantes — últimos 12 meses</CardTitle>
          <CardDescription>
            Barras: novos registros e convertidos por mês · Linha: total acumulado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SubscriberChart data={chartData} />
        </CardContent>
      </Card>

      {/* Recent signups */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos cadastros</CardTitle>
        </CardHeader>
        <CardContent>
          {recentSignups.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum cadastro ainda.</p>
          ) : (
            <div className="divide-y">
              {recentSignups.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.createdAt}</p>
                  </div>
                  {statusBadge(p.status)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Health — auto-refreshes every 30s */}
      <SystemHealthMetrics />
    </div>
  );
}
