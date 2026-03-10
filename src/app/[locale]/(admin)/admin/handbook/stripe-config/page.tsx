'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Copy, ExternalLink, Check, ArrowLeft, AlertTriangle, Webhook, Package } from 'lucide-react';
import Link from 'next/link';
import { useState, useCallback } from 'react';

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-md px-3 py-2">
      <code className="text-xs font-mono flex-1 break-all">{label}</code>
      <button
        onClick={handleCopy}
        className="shrink-0 p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        title="Copiar"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
    </div>
  );
}

export default function StripeConfigPage() {
  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/handbook">
          <Button variant="ghost" size="icon" className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-xl bg-violet-100 dark:bg-violet-950/30">
            <CreditCard className="h-7 w-7 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Stripe Configuration</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Keys, webhooks, produto e links rápidos
            </p>
          </div>
        </div>
      </div>

      {/* TEST MODE */}
      <Card className="border-2 border-green-200 dark:border-green-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-green-600" />
              Test Mode (Desenvolvimento)
            </CardTitle>
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              Configurado
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Publishable Key</p>
            <CopyButton
              text="Ver no Stripe Dashboard → Developers → API Keys → Publishable key"
              label="pk_test_••••••••••••"
            />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Secret Key</p>
            <CopyButton
              text="Ver no Vercel → Environment Variables → STRIPE_SECRET_KEY"
              label="sk_test_••••••••••••"
            />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Price ID</p>
            <CopyButton
              text="Ver no Stripe Dashboard → Products → CircleHood Booking Pro → Price ID"
              label="price_••••••••••••"
            />
          </div>

          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
            <p className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">Cartoes de Teste</p>
            <div className="space-y-1">
              <CopyButton text="4242424242424242" label="4242 4242 4242 4242 (sucesso)" />
              <CopyButton text="4000000000009995" label="4000 0000 0000 9995 (falha)" />
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Qualquer data futura + qualquer CVC de 3 digitos
            </p>
          </div>
        </CardContent>
      </Card>

      {/* LIVE MODE */}
      <Card className="border-2 border-amber-200 dark:border-amber-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Live Mode (Producao)
            </CardTitle>
            <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-300">
              Nao configurado
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Para ativar o live mode quando tiver clientes reais:
            </p>
            <ol className="space-y-2 text-sm">
              <li className="flex gap-2">
                <span className="font-bold text-amber-600 shrink-0">1.</span>
                <span>Stripe Dashboard &rarr; desliga &quot;Test mode&quot;</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-amber-600 shrink-0">2.</span>
                <span>Copia keys <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">pk_live_</code> e <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 rounded">sk_live_</code></span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-amber-600 shrink-0">3.</span>
                <span>Atualiza no Vercel (Production env)</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-amber-600 shrink-0">4.</span>
                <span>Cria webhook live com mesmos events</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-amber-600 shrink-0">5.</span>
                <span>Testa com cartao real (pode ser 1 centimo)</span>
              </li>
            </ol>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                <strong>Sem pressa!</strong> Test mode funciona perfeitamente para lancamento.
                Ativa live mode so quando tiver clientes reais a pagar.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* WEBHOOKS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Webhook className="h-5 w-5 text-indigo-600" />
            Webhooks
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px]">
                TEST
              </Badge>
              <p className="text-xs font-medium">Deposit Webhook</p>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">URL</p>
                <CopyButton
                  text="https://circlehood-booking.vercel.app/api/webhooks/stripe-deposit"
                  label="https://circlehood-booking.vercel.app/api/webhooks/stripe-deposit"
                />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Webhook Secret</p>
                <CopyButton
                  text="Ver no Stripe Dashboard → Developers → Webhooks → Signing secret"
                  label="whsec_••••••••••••"
                />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Events</p>
                <div className="flex flex-wrap gap-1">
                  {[
                    'customer.subscription.created',
                    'customer.subscription.updated',
                    'customer.subscription.deleted',
                    'payment_intent.succeeded',
                    'payment_intent.payment_failed',
                  ].map((event) => (
                    <Badge key={event} variant="outline" className="text-[10px] font-mono">
                      {event}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">
                LIVE
              </Badge>
              <p className="text-xs font-medium text-muted-foreground">Configurar depois</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Mesma URL, novo webhook secret. Criar quando ativar live mode.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* PRODUTO */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5 text-purple-600" />
            Produto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Nome</p>
              <p className="text-sm font-semibold">CircleHood Booking Pro</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor</p>
              <p className="text-sm font-semibold text-green-600">25,00/mes</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Trial</p>
              <p className="text-sm font-semibold">14 dias</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Recorrencia</p>
              <p className="text-sm font-semibold">Mensal</p>
            </div>
          </div>
          <div className="space-y-2 pt-2">
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Product ID</p>
              <CopyButton text="Ver no Stripe Dashboard → Products → CircleHood Booking Pro" label="prod_••••••••••••" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Price ID</p>
              <CopyButton text="Ver no Vercel → Environment Variables → STRIPE_PRICE_ID" label="price_••••••••••••" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* QUICK LINKS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Links</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Stripe Dashboard', url: 'https://dashboard.stripe.com' },
              { label: 'Webhooks', url: 'https://dashboard.stripe.com/test/webhooks' },
              { label: 'Subscriptions', url: 'https://dashboard.stripe.com/test/subscriptions' },
              { label: 'Customers', url: 'https://dashboard.stripe.com/test/customers' },
              { label: 'Products', url: 'https://dashboard.stripe.com/test/products' },
              { label: 'API Keys', url: 'https://dashboard.stripe.com/test/apikeys' },
            ].map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" className="w-full justify-between text-sm">
                  {link.label}
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
