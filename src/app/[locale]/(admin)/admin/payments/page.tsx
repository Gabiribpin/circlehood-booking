import { getStripe, PRICE_ID } from '@/lib/stripe';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Stripe from 'stripe';

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default async function AdminPaymentsPage() {
  const stripe = getStripe();
  const isLiveMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live') ?? false;

  // ── Fetch data in parallel ─────────────────────────────────────────────────
  let balance: Stripe.Balance | null = null;
  let price: Stripe.Price | null = null;
  let invoices: Stripe.Invoice[] = [];
  let payouts: Stripe.Payout[] = [];
  let stripeError: string | null = null;

  try {
    const [balanceRes, priceRes, invoicesRes, payoutsRes] = await Promise.allSettled([
      stripe.balance.retrieve(),
      PRICE_ID ? stripe.prices.retrieve(PRICE_ID, { expand: ['product'] }) : Promise.reject('No PRICE_ID'),
      stripe.invoices.list({
        status: 'paid',
        limit: 15,
        expand: ['data.customer'],
      }),
      stripe.payouts.list({ limit: 10 }),
    ]);

    if (balanceRes.status === 'fulfilled') balance = balanceRes.value;
    if (priceRes.status === 'fulfilled') price = priceRes.value;
    if (invoicesRes.status === 'fulfilled') invoices = invoicesRes.value.data;
    if (payoutsRes.status === 'fulfilled') payouts = payoutsRes.value.data;
  } catch (err: any) {
    stripeError = err?.message ?? 'Erro ao conectar ao Stripe';
  }

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configuração de Recebimentos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Status da conta Stripe e histórico de recebimentos
          </p>
        </div>
        <Badge variant={isLiveMode ? 'default' : 'secondary'} className="text-xs">
          {isLiveMode ? '🟢 Live mode' : '🟡 Test mode'}
        </Badge>
      </div>

      {stripeError && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          ❌ Stripe: {stripeError}
        </div>
      )}

      {/* Status + Balance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Account status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status da conta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Modo</span>
              <Badge variant={isLiveMode ? 'default' : 'secondary'}>
                {isLiveMode ? 'Produção' : 'Teste'}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Price ID</span>
              <code className="text-xs bg-muted px-2 py-1 rounded max-w-[180px] truncate">
                {PRICE_ID || 'Não configurado'}
              </code>
            </div>
            {price && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Produto</span>
                  <span className="text-sm font-medium">
                    {(price.product as Stripe.Product)?.name ?? '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Preço</span>
                  <span className="text-sm font-medium">
                    {formatCurrency((price.unit_amount ?? 0) / 100, price.currency)}
                    {price.recurring && ` / ${price.recurring.interval === 'month' ? 'mês' : 'ano'}`}
                  </span>
                </div>
              </>
            )}
            <div className="pt-2">
              <a
                href="https://dashboard.stripe.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary underline underline-offset-2"
              >
                Abrir Stripe Dashboard →
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Balance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saldo da conta</CardTitle>
            <CardDescription>Valores disponíveis e pendentes</CardDescription>
          </CardHeader>
          <CardContent>
            {!balance ? (
              <p className="text-sm text-muted-foreground">Indisponível</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Disponível</p>
                  {balance.available.length === 0 ? (
                    <p className="text-sm">— 0,00</p>
                  ) : (
                    balance.available.map((b) => (
                      <p key={b.currency} className="text-2xl font-bold text-green-600">
                        {formatCurrency(b.amount / 100, b.currency)}
                      </p>
                    ))
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Pendente</p>
                  {balance.pending.length === 0 ? (
                    <p className="text-sm text-muted-foreground">0,00</p>
                  ) : (
                    balance.pending.map((b) => (
                      <p key={b.currency} className="text-lg font-semibold text-amber-600">
                        {formatCurrency(b.amount / 100, b.currency)}
                      </p>
                    ))
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent paid invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de recebimentos</CardTitle>
          <CardDescription>Últimas 15 faturas pagas</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma fatura paga encontrada{!isLiveMode ? ' (modo de teste)' : ''}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="text-left pb-2 font-medium">Data</th>
                    <th className="text-left pb-2 font-medium">Cliente</th>
                    <th className="text-right pb-2 font-medium">Valor</th>
                    <th className="text-right pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invoices.map((inv) => {
                    const customer = inv.customer as Stripe.Customer | null;
                    return (
                      <tr key={inv.id}>
                        <td className="py-2.5 text-muted-foreground">
                          {formatDate(inv.created)}
                        </td>
                        <td className="py-2.5">
                          {customer?.email ?? customer?.name ?? inv.customer_email ?? '—'}
                        </td>
                        <td className="py-2.5 text-right font-medium">
                          {formatCurrency((inv.amount_paid ?? 0) / 100, inv.currency)}
                        </td>
                        <td className="py-2.5 text-right">
                          <Badge variant="default" className="text-[10px]">
                            Pago
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payouts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transferências para conta bancária</CardTitle>
          <CardDescription>Últimas transferências (payouts) do Stripe</CardDescription>
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma transferência encontrada{!isLiveMode ? ' (modo de teste, sem payouts automáticos)' : ''}.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="text-left pb-2 font-medium">Data</th>
                    <th className="text-left pb-2 font-medium">Descrição</th>
                    <th className="text-right pb-2 font-medium">Valor</th>
                    <th className="text-right pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payouts.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 text-muted-foreground">
                        {formatDate(p.arrival_date)}
                      </td>
                      <td className="py-2.5 text-muted-foreground">
                        {p.description ?? 'Transferência automática'}
                      </td>
                      <td className="py-2.5 text-right font-medium">
                        {formatCurrency(p.amount / 100, p.currency)}
                      </td>
                      <td className="py-2.5 text-right">
                        <Badge
                          variant={p.status === 'paid' ? 'default' : 'secondary'}
                          className="text-[10px]"
                        >
                          {p.status === 'paid'
                            ? 'Pago'
                            : p.status === 'pending'
                              ? 'Pendente'
                              : p.status}
                        </Badge>
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
