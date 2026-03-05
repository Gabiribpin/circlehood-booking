import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

function ServiceBox({
  icon, title, items, borderColor, bgColor, textColor,
}: {
  icon: string; title: string; items: string[];
  borderColor: string; bgColor: string; textColor: string;
}) {
  return (
    <div className={`rounded-xl border-2 px-3 py-2.5 ${borderColor} ${bgColor}`}>
      <div className={`flex items-center gap-1.5 mb-1.5 ${textColor}`}>
        <span className="text-base">{icon}</span>
        <span className="text-xs font-bold">{title}</span>
      </div>
      <ul className={`space-y-0.5 ${textColor}`}>
        {items.map((item) => (
          <li key={item} className="text-[11px] opacity-75 leading-snug">· {item}</li>
        ))}
      </ul>
    </div>
  );
}

function Arrow({ label, bidirectional = false }: { label?: string; bidirectional?: boolean }) {
  return (
    <div className="flex justify-center py-2">
      <div className="flex flex-col items-center gap-0.5">
        <div className="w-px h-4 bg-slate-300 dark:bg-slate-600" />
        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm">
          <span className="text-slate-400 text-xs font-mono">{bidirectional ? '↕' : '↓'}</span>
          {label && <span className="text-[10px] text-muted-foreground">{label}</span>}
        </div>
        <div className="w-px h-4 bg-slate-300 dark:bg-slate-600" />
      </div>
    </div>
  );
}

function LayerLabel({ children }: { children: string }) {
  return (
    <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em] text-center mb-3">
      {children}
    </p>
  );
}

export default function HandbookDiagramaPage() {
  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-5xl">
      <Link
        href="/admin/handbook"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao Handbook
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">🏗️ Diagrama de Infraestrutura</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Todas as tecnologias do CircleHood Booking e como se conectam
        </p>
      </div>

      {/* ── DIAGRAMA PRINCIPAL ── */}
      <div className="overflow-x-auto pb-4">
        <div className="min-w-[760px] space-y-0">

          {/* ── LAYER 1: USUÁRIOS ── */}
          <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
            <LayerLabel>Utilizadores</LayerLabel>
            <div className="flex gap-3 justify-center flex-wrap">
              {[
                { icon: '👤', title: 'Clientes',             sub: 'Agendamento via página pública' },
                { icon: '💼', title: 'Profissionais',        sub: 'Dashboard + bot WhatsApp' },
                { icon: '📱', title: 'Clientes via WA',      sub: 'Bot de agendamento' },
                { icon: '🛡️', title: 'Admin CircleHood',    sub: 'Gabi — painel /admin' },
              ].map((u) => (
                <div
                  key={u.title}
                  className="flex flex-col items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 min-w-[140px] text-center shadow-sm"
                >
                  <span className="text-2xl">{u.icon}</span>
                  <span className="text-xs font-bold">{u.title}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{u.sub}</span>
                </div>
              ))}
            </div>
          </div>

          <Arrow label="HTTPS" />

          {/* ── LAYER 2: VERCEL + NEXT.JS ── */}
          <div className="rounded-2xl border-2 border-violet-300 dark:border-violet-700 bg-violet-50 dark:bg-violet-950/30 px-6 py-4">
            <LayerLabel>Hosting & Plataforma</LayerLabel>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-2xl">▲</span>
                <div>
                  <p className="font-bold text-sm text-violet-900 dark:text-violet-200">
                    Vercel — CDN + Edge Network
                  </p>
                  <code className="text-[11px] text-violet-600 dark:text-violet-400">
                    booking.circlehood-tech.com
                  </code>
                </div>
              </div>
              <div className="w-px h-8 bg-violet-300 dark:bg-violet-700 hidden sm:block" />
              <div className="flex items-center gap-2">
                <span className="text-2xl">⬡</span>
                <div>
                  <p className="font-bold text-sm text-violet-900 dark:text-violet-200">
                    Next.js 14 — App Router
                  </p>
                  <code className="text-[11px] text-violet-600 dark:text-violet-400">
                    Turbopack · i18n (next-intl v4) · RSC
                  </code>
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap justify-center">
                {['PT-BR', 'EN-US', 'ES-ES'].map((loc) => (
                  <span key={loc} className="text-[10px] bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full font-mono">
                    {loc}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <Arrow label="SSR + API Routes" />

          {/* ── LAYER 3: APLICAÇÃO ── */}
          <div className="grid grid-cols-3 gap-3">
            <ServiceBox
              icon="🌐" title="Páginas Públicas"
              items={['/{slug} — Agendamento', '/booking/success', '/booking/cancel', 'Locale: sem prefixo (PT-BR)']}
              borderColor="border-sky-300 dark:border-sky-700"
              bgColor="bg-sky-50 dark:bg-sky-950/30"
              textColor="text-sky-900 dark:text-sky-200"
            />
            <ServiceBox
              icon="📅" title="Dashboard (auth)"
              items={['/dashboard — Visão geral', '/services, /bookings', '/settings, /analytics', '/whatsapp-config, /clients']}
              borderColor="border-indigo-300 dark:border-indigo-700"
              bgColor="bg-indigo-50 dark:bg-indigo-950/30"
              textColor="text-indigo-900 dark:text-indigo-200"
            />
            <ServiceBox
              icon="🛡️" title="Painel Admin (cookie)"
              items={['/admin/dashboard — Vendas', '/admin/support — Chamados', '/admin/leads — Leads', '/admin/handbook — Docs']}
              borderColor="border-slate-300 dark:border-slate-600"
              bgColor="bg-slate-50 dark:bg-slate-800/40"
              textColor="text-slate-800 dark:text-slate-200"
            />
          </div>

          <Arrow label="chamadas internas" bidirectional />

          {/* ── LAYER 4: API ROUTES + CRONS ── */}
          <div className="grid grid-cols-2 gap-3">
            <ServiceBox
              icon="⚡" title="API Routes"
              items={[
                '/api/bookings — Agendamento público',
                '/api/whatsapp/webhook — Mensagens WA',
                '/api/webhooks/stripe-* — Pagamentos',
                '/api/sales-bot/webhook — Bot vendas',
                '/api/stripe/connect/* — Onboarding',
                '/api/cron/* — Lógica agendada',
              ]}
              borderColor="border-amber-300 dark:border-amber-700"
              bgColor="bg-amber-50 dark:bg-amber-950/30"
              textColor="text-amber-900 dark:text-amber-200"
            />
            <ServiceBox
              icon="⏰" title="Crons Vercel (11 jobs)"
              items={[
                'send-reminders — 10h00',
                'birthdays — 08h00',
                'cleanup-tokens — 02h00',
                'process-deletions — 03h00',
                'send-trial-expiration — 10h00',
                'refresh-analytics, expire-waitlist...',
              ]}
              borderColor="border-orange-300 dark:border-orange-700"
              bgColor="bg-orange-50 dark:bg-orange-950/30"
              textColor="text-orange-900 dark:text-orange-200"
            />
          </div>

          <Arrow label="queries & writes" bidirectional />

          {/* ── LAYER 5: DADOS ── */}
          <div className="grid grid-cols-2 gap-3">
            <ServiceBox
              icon="🗄️" title="Supabase"
              items={[
                'PostgreSQL — RLS por tenant',
                'Auth — email + Google OAuth',
                'Storage — avatars + covers',
                '~30 tabelas (professionals, bookings…)',
                '${NEXT_PUBLIC_SUPABASE_URL}',
              ]}
              borderColor="border-emerald-300 dark:border-emerald-700"
              bgColor="bg-emerald-50 dark:bg-emerald-950/30"
              textColor="text-emerald-900 dark:text-emerald-200"
            />
            <ServiceBox
              icon="💾" title="Redis (RedisLabs — EU West)"
              items={[
                'Cache de histórico de conversas',
                'Deduplicação de mensagens do bot',
                'TTL: 24h por conversa',
                '${REDIS_URL} — ver env var',
              ]}
              borderColor="border-red-300 dark:border-red-700"
              bgColor="bg-red-50 dark:bg-red-950/30"
              textColor="text-red-900 dark:text-red-200"
            />
          </div>

          <Arrow label="API calls & webhooks" bidirectional />

          {/* ── LAYER 6: SERVIÇOS EXTERNOS ── */}
          <div className="rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
            <LayerLabel>Serviços Externos</LayerLabel>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {[
                {
                  icon: '🤖', name: 'Anthropic',
                  sub: 'claude-sonnet-4-6\nBot + suporte + IA',
                  border: 'border-orange-200 dark:border-orange-800',
                  bg: 'bg-orange-50 dark:bg-orange-950/50',
                },
                {
                  icon: '📱', name: 'Evolution API',
                  sub: 'WhatsApp QR Code\nMensagens + webhooks',
                  border: 'border-green-200 dark:border-green-800',
                  bg: 'bg-green-50 dark:bg-green-950/50',
                },
                {
                  icon: '📧', name: 'Resend',
                  sub: 'Emails transac.\nConfirm. + notif.',
                  border: 'border-blue-200 dark:border-blue-800',
                  bg: 'bg-blue-50 dark:bg-blue-950/50',
                },
                {
                  icon: '💳', name: 'Stripe',
                  sub: 'Pagamentos\n+ Connect (split 5%)',
                  border: 'border-violet-200 dark:border-violet-800',
                  bg: 'bg-violet-50 dark:bg-violet-950/50',
                },
                {
                  icon: '📅', name: 'Google',
                  sub: 'Calendar OAuth\nSincronização',
                  border: 'border-sky-200 dark:border-sky-800',
                  bg: 'bg-sky-50 dark:bg-sky-950/50',
                },
                {
                  icon: '📸', name: 'Instagram',
                  sub: 'Graph API v18\nPosts automáticos',
                  border: 'border-pink-200 dark:border-pink-800',
                  bg: 'bg-pink-50 dark:bg-pink-950/50',
                },
              ].map((svc) => (
                <div
                  key={svc.name}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 px-2 py-3 text-center ${svc.border} ${svc.bg}`}
                >
                  <span className="text-xl">{svc.icon}</span>
                  <span className="text-[11px] font-bold leading-tight">{svc.name}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight whitespace-pre-line">{svc.sub}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── FLUXO PRINCIPAL: AGENDAMENTO ── */}
      <div className="space-y-3">
        <h2 className="text-base font-bold">📋 Fluxo Principal — Agendamento de Cliente</h2>
        <div className="flex flex-wrap gap-0 items-center text-xs">
          {[
            { step: '1', label: 'Cliente acede /{slug}', color: 'bg-sky-100 dark:bg-sky-900/40 border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-200' },
            { step: '→', label: '', color: 'bg-transparent border-0 text-muted-foreground px-1' },
            { step: '2', label: 'Vercel render page.tsx', color: 'bg-violet-100 dark:bg-violet-900/40 border-violet-300 dark:border-violet-700 text-violet-800 dark:text-violet-200' },
            { step: '→', label: '', color: 'bg-transparent border-0 text-muted-foreground px-1' },
            { step: '3', label: 'POST /api/bookings', color: 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200' },
            { step: '→', label: '', color: 'bg-transparent border-0 text-muted-foreground px-1' },
            { step: '4', label: 'INSERT → Supabase', color: 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200' },
            { step: '→', label: '', color: 'bg-transparent border-0 text-muted-foreground px-1' },
            { step: '5', label: 'Resend (email confirm.)', color: 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200' },
            { step: '→', label: '', color: 'bg-transparent border-0 text-muted-foreground px-1' },
            { step: '6', label: 'Evolution API (WA)', color: 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200' },
          ].map((item, i) => (
            item.step === '→'
              ? <span key={i} className="text-muted-foreground text-base font-bold">→</span>
              : (
                <div key={i} className={`flex flex-col items-center gap-0.5 border-2 rounded-lg px-3 py-2 ${item.color}`}>
                  <span className="font-bold text-[10px] opacity-60">Step {item.step}</span>
                  <span className="font-medium text-center leading-tight">{item.label}</span>
                </div>
              )
          ))}
        </div>
      </div>

      {/* ── FLUXO: BOT WHATSAPP ── */}
      <div className="space-y-3">
        <h2 className="text-base font-bold">🤖 Fluxo — Bot WhatsApp</h2>
        <div className="flex flex-wrap gap-0 items-center text-xs">
          {[
            { step: '1', label: 'Cliente envia WA', color: 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200' },
            '→',
            { step: '2', label: 'Evolution API\n(webhook →)', color: 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200' },
            '→',
            { step: '3', label: '/api/whatsapp/webhook', color: 'bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200' },
            '→',
            { step: '4', label: 'Redis\n(histórico cache)', color: 'bg-red-100 dark:bg-red-900/40 border-red-300 dark:border-red-700 text-red-800 dark:text-red-200' },
            '→',
            { step: '5', label: 'Anthropic Claude\n(tools agentic)', color: 'bg-orange-100 dark:bg-orange-900/40 border-orange-300 dark:border-orange-700 text-orange-800 dark:text-orange-200' },
            '→',
            { step: '6', label: 'Supabase\n(INSERT booking)', color: 'bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200' },
            '→',
            { step: '7', label: 'Evolution API\n(resposta WA)', color: 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700 text-green-800 dark:text-green-200' },
          ].map((item, i) => (
            item === '→'
              ? <span key={i} className="text-muted-foreground text-base font-bold">→</span>
              : (
                <div key={i} className={`flex flex-col items-center gap-0.5 border-2 rounded-lg px-2.5 py-2 ${(item as {color: string}).color}`}>
                  <span className="font-bold text-[10px] opacity-60">Step {(item as {step: string}).step}</span>
                  <span className="font-medium text-center leading-tight whitespace-pre-line">{(item as {label: string}).label}</span>
                </div>
              )
          ))}
        </div>
      </div>

      {/* ── LEGENDA ── */}
      <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
        <p className="text-xs font-bold text-muted-foreground">Legenda</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-1.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5"><span>↓</span> Fluxo unidirecional</div>
          <div className="flex items-center gap-1.5"><span>↕</span> Bidirecional (req + webhook)</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-violet-200 dark:bg-violet-800 shrink-0" /> Hosting / Plataforma</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-emerald-200 dark:bg-emerald-800 shrink-0" /> Armazenamento / DB</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-amber-200 dark:bg-amber-800 shrink-0" /> Lógica de Negócio (API)</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-orange-200 dark:bg-orange-800 shrink-0" /> IA / ML</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-green-200 dark:bg-green-800 shrink-0" /> Mensagens (WA / Email)</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-indigo-200 dark:bg-indigo-800 shrink-0" /> Interface / UI</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-red-200 dark:bg-red-800 shrink-0" /> Cache / Fila</div>
        </div>
      </div>
    </div>
  );
}
