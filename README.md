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

## Ambientes

| Ambiente | VERCEL_ENV | Supabase | Redis prefix | WhatsApp |
|----------|-----------|----------|-------------|----------|
| **Production** | `production` | `circlehood-booking` (prod) | `production:` | Envia mensagens reais |
| **Staging/Preview** | `preview` | `cuwhyixgkfhioubejtaw` (staging) | `preview:` | Loga mas **não envia** |
| **Local** | — | `.env.local` | `development:` | Depende de config local |

**Isolamento Redis:** todas as keys são prefixadas com `{env}:` (ex: `production:conversation:abc`), permitindo que ambientes compartilhem a mesma instância Redis sem conflito.

**Guardrails:**
- `src/lib/env-validation.ts` — bloqueia preview apontando para DB de produção (requer `SUPABASE_PRODUCTION_REF`)
- `src/app/api/whatsapp/webhook/route.ts` — em `preview`, loga webhooks mas não processa mensagens reais

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

Os testes Playwright rodam contra a URL configurada em `TEST_BASE_URL` e interagem diretamente com o banco via service role key para setup/teardown de dados.

#### Banco de dados separado para testes (recomendado)

O CI usa um **projeto Supabase dedicado** para testes, evitando poluição do banco de produção com registros `[E2E]`. Para configurar:

1. Crie um projeto Supabase separado (ex: `circlehood-booking-test`)
2. Execute todas as migrations em `supabase/migrations/` no novo projeto
3. Crie um usuário de teste com e-mail/senha (será o `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`)
4. No GitHub → Settings → Environments → crie o environment **`test`**
5. Adicione os seguintes secrets no environment `test` (sobrescrevem os secrets de repositório):

   | Secret | Valor |
   |--------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto de teste |
   | `SUPABASE_SERVICE_ROLE_KEY` | Service role key do projeto de teste |
   | `TEST_USER_EMAIL` | E-mail do usuário de teste |
   | `TEST_USER_PASSWORD` | Senha do usuário de teste |

Os demais secrets (`CRON_SECRET`, `REDIS_URL`, etc.) são herdados dos secrets de repositório se não definidos no environment.

> **Como funciona:** todos os jobs E2E no CI têm `environment: test`. O GitHub Actions resolve `${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}` do environment `test` quando disponível, caindo nos secrets de repositório caso contrário. O job `cleanup-test-db` roda ao final **sempre** (`if: always()`), mesmo se testes falharem, e apaga dados de teste via Supabase REST API.

#### Rodar localmente contra banco de testes

Crie o arquivo `.env.test.local` com as credenciais do banco de teste:

```env
# .env.test.local — banco separado para testes locais (não comitar)
NEXT_PUBLIC_SUPABASE_URL=https://<test-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<test-service-role-key>
TEST_USER_EMAIL=teste@exemplo.com
TEST_USER_PASSWORD=senha-do-usuario-de-teste
TEST_BASE_URL=https://circlehood-booking.vercel.app
```

Depois rode os testes sobrescrevendo as variáveis:

```bash
# Carregar env de teste e rodar suite desejada
set -a && source .env.test.local && set +a

# API pública + ciclo do profissional
npx playwright test --project=api-tests

# Dashboard autenticado
npx playwright test --project=auth-setup --project=dashboard

# Bot (chama Claude — demora ~30s por teste)
npx playwright test --project=bot-reschedule

# Tudo (exclui projetos que usam Claude)
npx playwright test --project=auth-setup \
  --project=api-tests --project=security --project=dashboard \
  --project=navigation --project=ux --project=mobile \
  --project=critical-race --project=critical-idempotency \
  --project=notifications --project=timezone-dst \
  --project=blocked-periods-api --project=payment
```

#### Convenções de nomenclatura para dados de teste

Todo dado criado por testes deve seguir estes padrões para que o cleanup automático funcione:

| Campo | Prefixo/sufixo obrigatório | Exemplo |
|-------|---------------------------|---------|
| `bookings.client_name` | Contém `E2E`, `Teste`, `Race` ou `Lifecycle` | `"Cliente E2E - Corte"` |
| `services.name` | Contém `[E2E]` | `"Corte [E2E]"` |
| `contacts.name` | Contém `E2E` | `"Contato E2E"` |

O job `cleanup-test-db` apaga todos esses registros automaticamente ao final de cada run do CI.

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
