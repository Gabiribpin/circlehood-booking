<div align="center">
  <img src="public/branding/circlehood-tech-logo.png" width="96" alt="CircleHood Tech" />
  <h1>CircleHood Booking</h1>
  <p><strong>by CircleHood Tech</strong></p>
  <p>Plataforma de agendamento profissional enterprise-grade para cabeleireiras, nail techs, barbeiros, personal trainers e mais.</p>
</div>

---

## Sobre

**CircleHood Booking** é um SaaS de agendamento online desenvolvido pela [CircleHood Tech](https://circlehood-tech.com). Cada profissional tem a sua própria página pública (ex: `book.circlehood-tech.com/maria-nails`) onde os clientes podem agendar serviços 24h/dia.

## Stack

- **Next.js 14** App Router (server + client components)
- **Supabase** — auth, DB (PostgreSQL + RLS), storage
- **Stripe** — pagamentos e sinais de reserva
- **Resend** — emails transacionais
- **Evolution API / Meta Business** — WhatsApp Bot
- **Anthropic Claude** — bot de agendamento inteligente
- **Vercel** — deploy + crons
- **Playwright** — testes E2E

## Funcionalidades

### Para profissionais
- Página pública personalizada com agendamento online
- Gestão de serviços, horários e agendamentos
- CRM de clientes com histórico e segmentação
- Analytics de receita, serviços e clientes
- WhatsApp Bot inteligente (agendamento, reagendamento, cancelamento)
- Sistema de campanhas e automações
- Galeria de fotos e depoimentos
- Sinal de reserva configurável (Stripe)
- Editor de página com secções customizadas

### Técnico / Qualidade
- Multi-tenant com RLS (Row Level Security)
- Fail-safe em notificações (retry + timeout)
- Idempotência anti-duplicatas (janela 5 min)
- Validação Zod + sanitização XSS
- Lazy loading de componentes pesados (recharts)
- ~250+ testes E2E automatizados
- CI com 18+ jobs organizados em camadas

## Configuração

### Variáveis de ambiente

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe (pagamentos de sinais)
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_DEPOSIT_WEBHOOK_SECRET=

# Stripe (subscriptions)
STRIPE_PRICE_ID=
STRIPE_WEBHOOK_SECRET=

# Resend (emails)
RESEND_API_KEY=

# Anthropic (bot)
ANTHROPIC_API_KEY=

# Evolution API (WhatsApp)
EVOLUTION_API_URL=
EVOLUTION_API_KEY=

# Crons (Vercel)
CRON_SECRET=
```

### Desenvolvimento local

```bash
npm install
npm run dev
```

### Testes E2E

```bash
# Setup + testes principais
npx playwright test --project=auth-setup --project=api-tests

# Dashboard autenticado
npx playwright test --project=auth-setup --project=dashboard

# Pagamentos
npx playwright test --project=payment
```

### Migrations (Supabase)

Aplicar pela ordem em `supabase/migrations/`:

```bash
# Via Supabase CLI
supabase db push
```

## Estrutura de Pastas

```
src/
├── app/
│   ├── (auth)/          # Login, register, reset password
│   ├── (dashboard)/     # Painel do profissional (autenticado)
│   ├── (public)/[slug]  # Página pública do profissional
│   └── api/             # API routes
├── components/
│   ├── analytics/       # Gráficos de receita, serviços, clientes
│   ├── booking/         # Formulário de agendamento público
│   ├── branding/        # Logo CircleHood Tech
│   ├── checkout/        # Stripe Elements (pagamento de sinal)
│   ├── dashboard/       # Componentes do painel
│   └── ui/              # shadcn/ui base
├── lib/
│   ├── ai/              # WhatsApp Bot (Anthropic Claude)
│   ├── email/           # Resend + safe-send
│   ├── payment/         # calculateDeposit, refund
│   ├── stripe/          # Client + server Stripe
│   ├── supabase/        # Client, server, admin
│   ├── validation/      # Zod schemas + XSS sanitization
│   └── whatsapp/        # Evolution API + safe-send
└── types/
    └── database.ts      # TypeScript interfaces

e2e/
├── auth/                # Setup de sessão
├── api/                 # Testes de API pública
├── bot/                 # Testes do WhatsApp Bot
├── critical/            # Race conditions, idempotência
├── dashboard/           # Testes autenticados
├── failsafe/            # Resiliência de notificações
├── payment/             # Fluxo de pagamento Stripe
├── performance/         # Tempos de carga
├── security/            # Auth, autorização, injeção
└── validation/          # Zod, XSS, dados malformados
```

---

<div align="center">
  <p>by <strong>CircleHood Tech</strong> · © 2026 Todos os direitos reservados</p>
</div>
