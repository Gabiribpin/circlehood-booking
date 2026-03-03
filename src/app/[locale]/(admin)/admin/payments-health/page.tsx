import { createAdminClient } from '@/lib/supabase/admin';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, CheckCircle, XCircle, RefreshCw, DollarSign, AlertTriangle } from 'lucide-react';
import { PaymentsHealthChart, type RevenueDataPoint } from '@/components/admin/payments-health-chart';

export default async function PaymentsHealthPage() {
  const supabase = createAdminClient();

  const now = new Date();
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    pendingResult,
    stalePendingResult,
    conversionPendingResult,
    conversionConfirmedResult,
    paymentStatsResult,
    revenueResult,
    recentFailuresResult,
  ] = await Promise.allSettled([
    // Count all pending_payment bookings
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_payment'),

    // Stale pending payments (older than 30 min)
    supabase
      .from('bookings')
      .select('id, client_name, client_phone, service_id, booking_date, start_time, created_at')
      .eq('status', 'pending_payment')
      .lt('created_at', thirtyMinAgo.toISOString())
      .order('created_at', { ascending: true })
      .limit(20),

    // Conversion: pending_payment created in last 7d
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_payment')
      .gte('created_at', sevenDaysAgo.toISOString()),

    // Conversion: confirmed in last 7d
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'confirmed')
      .gte('created_at', sevenDaysAgo.toISOString()),

    // Payment stats last 24h
    supabase
      .from('payments')
      .select('status')
      .gte('created_at', twentyFourHoursAgo.toISOString()),

    // Revenue last 30 days (succeeded payments)
    supabase
      .from('payments')
      .select('amount, created_at')
      .eq('status', 'succeeded')
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: true }),

    // Recent failures
    supabase
      .from('payments')
      .select('id, booking_id, amount, currency, payment_method, created_at, metadata')
      .eq('status', 'failed')
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  // Extract data safely
  const pendingCount = pendingResult.status === 'fulfilled' ? (pendingResult.value.count ?? 0) : 0;
  const stalePending = stalePendingResult.status === 'fulfilled' ? (stalePendingResult.value.data ?? []) : [];
  const convPending = conversionPendingResult.status === 'fulfilled' ? (conversionPendingResult.value.count ?? 0) : 0;
  const convConfirmed = conversionConfirmedResult.status === 'fulfilled' ? (conversionConfirmedResult.value.count ?? 0) : 0;

  const paymentStats24h = paymentStatsResult.status === 'fulfilled' ? (paymentStatsResult.value.data ?? []) : [];
  const succeeded24h = paymentStats24h.filter(p => p.status === 'succeeded').length;
  const failed24h = paymentStats24h.filter(p => p.status === 'failed').length;
  const refunded24h = paymentStats24h.filter(p => p.status === 'refunded').length;

  const revenueData = revenueResult.status === 'fulfilled' ? (revenueResult.value.data ?? []) : [];
  const recentFailures = recentFailuresResult.status === 'fulfilled' ? (recentFailuresResult.value.data ?? []) : [];

  // Conversion rate
  const totalConvAttempts = convPending + convConfirmed;
  const conversionRate = totalConvAttempts > 0
    ? Math.round((convConfirmed / totalConvAttempts) * 100)
    : 0;

  // Build chart data: group revenue by day
  const revenueByDay = new Map<string, number>();
  for (const p of revenueData) {
    const day = new Date(p.created_at).toISOString().slice(0, 10);
    revenueByDay.set(day, (revenueByDay.get(day) ?? 0) + Number(p.amount));
  }

  // Fill missing days in the last 30 days
  const chartData: RevenueDataPoint[] = [];
  let cumulative = 0;
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayLabel = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    const dayRevenue = revenueByDay.get(key) ?? 0;
    cumulative += dayRevenue;
    chartData.push({ label: dayLabel, revenue: Number(dayRevenue.toFixed(2)), cumulative: Number(cumulative.toFixed(2)) });
  }

  const totalRevenue30d = cumulative;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Saúde de Pagamentos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitoramento de pagamentos, conversões e falhas
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Aguardando Pgto</p>
                <p className="text-3xl font-bold">{pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Sucesso 24h</p>
                <p className="text-3xl font-bold">{succeeded24h}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Falhas 24h</p>
                <p className="text-3xl font-bold">{failed24h}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                <RefreshCw className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Reembolsos 24h</p>
                <p className="text-3xl font-bold">{refunded24h}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Receita 30d</p>
                <p className="text-3xl font-bold">€{totalRevenue30d.toFixed(0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                <AlertTriangle className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Conversão 7d</p>
                <p className="text-3xl font-bold">{conversionRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardContent className="p-5">
          <h2 className="text-lg font-semibold mb-4">Receita Diária (últimos 30 dias)</h2>
          <PaymentsHealthChart data={chartData} />
        </CardContent>
      </Card>

      {/* Stale Pending Payments */}
      {stalePending.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <h2 className="text-lg font-semibold mb-4 text-amber-600">
              Pagamentos Pendentes &gt; 30min ({stalePending.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Cliente</th>
                    <th className="pb-2 pr-4">Telefone</th>
                    <th className="pb-2 pr-4">Data Agendamento</th>
                    <th className="pb-2 pr-4">Horário</th>
                    <th className="pb-2">Criado em</th>
                  </tr>
                </thead>
                <tbody>
                  {stalePending.map((b) => (
                    <tr key={b.id} className="border-b last:border-0">
                      <td className="py-2 pr-4">{b.client_name}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{b.client_phone ?? '—'}</td>
                      <td className="py-2 pr-4">{b.booking_date}</td>
                      <td className="py-2 pr-4">{b.start_time?.slice(0, 5)}</td>
                      <td className="py-2 text-muted-foreground">
                        {new Date(b.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Failures */}
      {recentFailures.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <h2 className="text-lg font-semibold mb-4 text-red-500">
              Últimas Falhas de Pagamento ({recentFailures.length})
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Booking ID</th>
                    <th className="pb-2 pr-4">Valor</th>
                    <th className="pb-2 pr-4">Método</th>
                    <th className="pb-2">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {recentFailures.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-mono text-xs">{p.booking_id?.slice(0, 8) ?? '—'}</td>
                      <td className="py-2 pr-4">{p.currency === 'EUR' ? '€' : p.currency}{Number(p.amount).toFixed(2)}</td>
                      <td className="py-2 pr-4">{p.payment_method ?? '—'}</td>
                      <td className="py-2 text-muted-foreground">
                        {new Date(p.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
