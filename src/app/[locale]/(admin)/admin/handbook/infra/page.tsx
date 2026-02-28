'use client';

import { useState } from 'react';
import { ArrowLeft, Copy, Check, Globe } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
      title="Copiar"
    >
      {copied
        ? <><Check className="h-3 w-3 text-green-500" /><span className="text-green-500">Copiado!</span></>
        : <Copy className="h-3 w-3" />}
    </button>
  );
}

const appUrls = [
  { url: 'http://localhost:3000',                      env: 'local',  label: 'Desenvolvimento local' },
  { url: 'https://circlehood-booking.vercel.app',      env: 'vercel', label: 'Vercel (redireciona → produção)' },
  { url: 'https://booking.circlehood-tech.com',        env: 'prod',   label: 'Produção — domínio principal' },
];

const services = [
  {
    category: '🗄️ Banco de Dados',
    color: 'border-emerald-300 dark:border-emerald-800',
    headerBg: 'bg-emerald-50 dark:bg-emerald-950/30',
    items: [
      { name: 'Supabase DB / Auth',  url: 'https://ibkkxykcrwhncvqxzynt.supabase.co', env: 'prod', note: 'NEXT_PUBLIC_SUPABASE_URL' },
      { name: 'Supabase Dashboard',  url: 'https://supabase.com/dashboard/project/ibkkxykcrwhncvqxzynt', env: 'admin', note: 'Login com conta Supabase' },
      { name: 'Supabase Auth users', url: 'https://supabase.com/dashboard/project/ibkkxykcrwhncvqxzynt/auth/users', env: 'admin', note: 'Ver/gerir utilizadores' },
    ],
  },
  {
    category: '⚡ Cache / Fila',
    color: 'border-red-300 dark:border-red-800',
    headerBg: 'bg-red-50 dark:bg-red-950/30',
    items: [
      { name: 'Redis (RedisLabs)', url: 'redis://default:***@redis-15673.c226.eu-west-1-3.ec2.cloud.redislabs.com:15673', env: 'prod', note: 'REDIS_URL — conversas do bot' },
    ],
  },
  {
    category: '💳 Pagamentos',
    color: 'border-violet-300 dark:border-violet-800',
    headerBg: 'bg-violet-50 dark:bg-violet-950/30',
    items: [
      { name: 'Stripe API',          url: 'https://api.stripe.com',                          env: 'prod',    note: 'STRIPE_SECRET_KEY (sk_live_*)' },
      { name: 'Stripe Dashboard',    url: 'https://dashboard.stripe.com',                    env: 'admin',   note: 'Recebimentos, webhooks' },
      { name: 'Stripe Webhooks',     url: 'https://dashboard.stripe.com/webhooks',           env: 'admin',   note: 'Configurar endpoints' },
      { name: 'Revolut (sandbox)',   url: 'https://sandbox-merchant.revolut.com/api/1.0',    env: 'dev',     note: 'NODE_ENV !== production' },
      { name: 'Revolut (prod)',      url: 'https://merchant.revolut.com/api/1.0',            env: 'prod',    note: 'REVOLUT_API_KEY' },
    ],
  },
  {
    category: '🤖 IA',
    color: 'border-orange-300 dark:border-orange-800',
    headerBg: 'bg-orange-50 dark:bg-orange-950/30',
    items: [
      { name: 'Anthropic (Claude)',  url: 'https://api.anthropic.com',                       env: 'prod',    note: 'ANTHROPIC_API_KEY (sk-ant-*)' },
      { name: 'Anthropic Console',   url: 'https://console.anthropic.com',                   env: 'admin',   note: 'Ver uso, API keys' },
    ],
  },
  {
    category: '📱 WhatsApp / Mensagens',
    color: 'border-green-300 dark:border-green-800',
    headerBg: 'bg-green-50 dark:bg-green-950/30',
    items: [
      { name: 'Evolution API',       url: 'https://realisticlobster-evolution.cloudfy.live', env: 'prod',    note: 'URL das credenciais no banco (whatsapp_config)' },
      { name: 'Meta Graph API',      url: 'https://graph.facebook.com/v18.0',                env: 'legacy',  note: 'Removido — Evolution API usada' },
    ],
  },
  {
    category: '📧 Email',
    color: 'border-blue-300 dark:border-blue-800',
    headerBg: 'bg-blue-50 dark:bg-blue-950/30',
    items: [
      { name: 'Resend API',          url: 'https://api.resend.com',                          env: 'prod',    note: 'RESEND_API_KEY (re_iebgvquj_*)' },
      { name: 'Resend Dashboard',    url: 'https://resend.com/emails',                       env: 'admin',   note: 'Ver logs de email enviados' },
    ],
  },
  {
    category: '🔗 Integrações',
    color: 'border-pink-300 dark:border-pink-800',
    headerBg: 'bg-pink-50 dark:bg-pink-950/30',
    items: [
      { name: 'Google OAuth',        url: 'https://accounts.google.com/o/oauth2/auth',       env: 'prod',    note: 'GOOGLE_CLIENT_ID / CLIENT_SECRET' },
      { name: 'Google Calendar API', url: 'https://www.googleapis.com/auth/calendar',        env: 'prod',    note: 'Scope da OAuth' },
      { name: 'Instagram Graph API', url: 'https://graph.instagram.com/v18.0',               env: 'prod',    note: 'INSTAGRAM_CLIENT_ID / CLIENT_SECRET' },
      { name: 'Instagram OAuth',     url: 'https://api.instagram.com/oauth/authorize',       env: 'prod',    note: 'Login do profissional' },
    ],
  },
  {
    category: '🏗️ Deploy / Infra',
    color: 'border-slate-300 dark:border-slate-700',
    headerBg: 'bg-slate-50 dark:bg-slate-950/30',
    items: [
      { name: 'Vercel Dashboard',    url: 'https://vercel.com/circlehoodtech-projects/circlehood-booking',      env: 'admin',  note: 'Deploy, logs, env vars' },
      { name: 'Vercel Logs',         url: 'https://vercel.com/circlehoodtech-projects/circlehood-booking/logs', env: 'admin',  note: 'Runtime errors em produção' },
    ],
  },
];

const webhooks = [
  { path: '/api/whatsapp/webhook',          direction: 'in',  desc: 'Recebe mensagens WhatsApp (Evolution API → profissionais)' },
  { path: '/api/webhooks/whatsapp-support', direction: 'in',  desc: 'Recebe mensagens WhatsApp do suporte CircleHood' },
  { path: '/api/sales-bot/webhook',         direction: 'in',  desc: 'Recebe mensagens WhatsApp para o bot de vendas' },
  { path: '/api/webhooks/stripe-deposit',   direction: 'in',  desc: 'Confirmação de pagamento de sinal (Stripe)' },
  { path: '/api/webhooks/stripe-connect',   direction: 'in',  desc: 'Status da conta Stripe Connect (account.updated)' },
  { path: '/api/stripe/webhook',            direction: 'in',  desc: 'Webhook geral do Stripe (assinaturas, etc.)' },
  { path: '/api/webhooks/revolut',          direction: 'in',  desc: 'Confirmação de pagamento Revolut' },
  { path: '/api/webhooks/resend',           direction: 'in',  desc: 'Eventos de email Resend (bounce, open, etc.)' },
];

const callbacks = [
  { path: '/api/integrations/google-calendar/callback', service: 'Google Calendar', desc: 'OAuth redirect após autorização' },
  { path: '/api/integrations/instagram/callback',       service: 'Instagram',       desc: 'OAuth redirect após autorização' },
  { path: '/booking/success',                           service: 'Stripe Checkout', desc: 'Redirect após pagamento de sinal' },
  { path: '/booking/cancel',                            service: 'Stripe Checkout', desc: 'Redirect se pagamento cancelado' },
  { path: '/settings/payment?connect=success',          service: 'Stripe Connect',  desc: 'Redirect após onboarding Stripe Express' },
  { path: '/settings/payment?connect=refresh',          service: 'Stripe Connect',  desc: 'Redirect para refresh do link de onboarding' },
];

const ENV_BADGE: Record<string, string> = {
  prod:   'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400',
  dev:    'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
  local:  'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400',
  vercel: 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400',
  admin:  'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  legacy: 'bg-red-100 text-red-600 dark:bg-red-950/30 dark:text-red-400',
};

export default function HandbookInfraPage() {
  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-4xl">
      <Link
        href="/admin/handbook"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao Handbook
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">🌐 URLs & Infraestrutura</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Todos os endpoints, serviços e ambientes do CircleHood Booking
        </p>
      </div>

      {/* Legenda ambientes */}
      <div className="flex flex-wrap gap-2 text-xs">
        {[
          { label: 'prod',   text: 'Produção' },
          { label: 'dev',    text: 'Dev/Sandbox' },
          { label: 'local',  text: 'Local' },
          { label: 'vercel', text: 'Vercel' },
          { label: 'admin',  text: 'Admin/Dashboard' },
          { label: 'legacy', text: 'Removido/Legacy' },
        ].map(({ label, text }) => (
          <span key={label} className={`px-2 py-0.5 rounded-full font-medium ${ENV_BADGE[label]}`}>
            {text}
          </span>
        ))}
      </div>

      {/* URLs da Aplicação */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-indigo-500" />
            <CardTitle className="text-base">URLs da Aplicação</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="divide-y rounded-lg border overflow-hidden">
            {appUrls.map((row) => (
              <div key={row.url} className="flex items-center px-4 py-3 gap-3 bg-background hover:bg-muted/30 transition-colors flex-wrap">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${ENV_BADGE[row.env]}`}>{row.env}</span>
                <code className="text-sm font-mono flex-1 min-w-0 break-all">{row.url}</code>
                <CopyButton value={row.url} />
                <span className="text-xs text-muted-foreground w-full sm:w-auto sm:text-right">{row.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Serviços externos */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Serviços Externos</h2>
        {services.map((group) => (
          <div key={group.category} className={`rounded-xl border-2 overflow-hidden ${group.color}`}>
            <div className={`px-4 py-2.5 font-bold text-sm ${group.headerBg}`}>
              {group.category}
            </div>
            <div className="divide-y bg-background">
              {group.items.map((item) => (
                <div key={item.url} className="flex items-center px-4 py-3 gap-3 hover:bg-muted/30 transition-colors flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${ENV_BADGE[item.env]}`}>{item.env}</span>
                  <span className="text-xs font-medium w-36 shrink-0">{item.name}</span>
                  <code className="text-xs font-mono flex-1 min-w-0 break-all text-muted-foreground">{item.url}</code>
                  {!item.url.startsWith('redis') && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline shrink-0">↗</a>
                  )}
                  <span className="text-xs text-muted-foreground w-full">{item.note}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Webhooks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">🔔 Webhooks (recebidos)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Base: <code className="bg-muted px-1 rounded">https://booking.circlehood-tech.com</code>
          </p>
        </CardHeader>
        <CardContent>
          <div className="divide-y rounded-lg border overflow-hidden">
            {webhooks.map((wh) => (
              <div key={wh.path} className="flex items-center px-4 py-3 gap-3 bg-background hover:bg-muted/30 transition-colors">
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 w-64 shrink-0">{wh.path}</code>
                <CopyButton value={`https://booking.circlehood-tech.com${wh.path}`} />
                <span className="text-xs text-muted-foreground">{wh.desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Callbacks OAuth / Redirects */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">↩️ Callbacks & Redirects</CardTitle>
          <p className="text-xs text-muted-foreground">
            URLs de retorno após OAuth e pagamentos
          </p>
        </CardHeader>
        <CardContent>
          <div className="divide-y rounded-lg border overflow-hidden">
            {callbacks.map((cb) => (
              <div key={cb.path} className="flex items-center px-4 py-3 gap-3 bg-background hover:bg-muted/30 transition-colors flex-wrap">
                <span className="text-xs font-medium text-muted-foreground w-32 shrink-0">{cb.service}</span>
                <code className="text-xs font-mono text-indigo-600 dark:text-indigo-400 flex-1 min-w-0">{cb.path}</code>
                <CopyButton value={`https://booking.circlehood-tech.com${cb.path}`} />
                <span className="text-xs text-muted-foreground w-full">{cb.desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
