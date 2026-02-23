# Changelog — CircleHood Booking

Todas as alterações notáveis neste projeto são documentadas aqui.

---

## [1.3.0] — 2026-02-23

### 🎨 Branding CircleHood Tech
- Logo CircleHood Tech adicionado (`public/branding/`)
- Componente `CircleHoodLogo` / `CircleHoodLogoFull` / `CircleHoodLogoCompact`
- Favicon atualizado (32×32 PNG via Next.js App Router `icon.png`)
- Apple Touch Icon (180×180)
- Logo na sidebar e header mobile do dashboard
- Logo nas páginas de autenticação (login, register, forgot password)
- Header com logo nos emails transacionais (Resend)
- Footer "by CircleHood Tech" nos emails
- Footer "Powered by CircleHood Tech" na página pública do profissional

---

## [1.2.0] — 2026-02-23

### 💳 Sistema de Pagamentos (Stripe)
- Migrations SQL: `payment_config` (campos em `professionals`) + tabela `payments`
- Tipos TypeScript: `Professional` atualizado, interface `Payment` criada
- `src/lib/stripe/server.ts` — singleton lazy (graceful sem `STRIPE_SECRET_KEY`)
- `src/lib/stripe/client.ts` — singleton lazy Stripe.js
- `src/lib/payment/calculate-deposit.ts` — `calculateDeposit()` + `toCents()`
- Dashboard: `/settings/payment` — configuração de sinal (percentagem ou valor fixo)
- API `GET/PUT /api/settings/payment` — autenticada
- API `POST /api/payment/create-intent` — cria Stripe PaymentIntent + registo `payments`
- Componente `PaymentForm` — Stripe Elements (lazy loaded, `ssr: false`)
- `booking-section.tsx` — step de pagamento inserido quando `require_deposit=true`
- `bookings/route.ts` — liga `payment_intent_id` à tabela `payments` após criar booking
- Webhook `POST /api/webhooks/stripe-deposit` — `payment_intent.succeeded/failed/processing`, `charge.refunded`
- `src/lib/payment/refund.ts` — `refundDeposit()` helper
- Teste E2E: `e2e/payment/01-deposit-flow.spec.ts` (8 testes)
- Playwright: projeto `payment` adicionado

---

## [1.1.0] — 2026-02-23

### 📊 Analytics PT-BR + Moeda Dinâmica
- `analytics-dashboard.tsx` — lazy loading com `next/dynamic` para recharts (~350KB)
- Prop `currency` propagada por toda a árvore de componentes analytics
- Símbolo de moeda dinâmico (€, £, $, R$) em todos os gráficos e tabelas
- UI completamente traduzida para Português Brasileiro
- Tabs: Receita, Serviços, Clientes
- Cards KPI: Receita Total, Agendamentos, Ticket Médio, Clientes Únicos
- Gráficos: Diário/Semanal/Mensal, Linha/Barras
- Tabela serviços: Rank, Serviço, Preço, Agendamentos, Receita, Média/Dia
- Tabela clientes: Total, Ativos, Em Risco, Inativos + badges PT-BR
- Teste E2E: `e2e/dashboard/10-analytics.spec.ts`
- `playwright.config.ts` — `testMatch` array para incluir `10-*.spec.ts`

### 👤 Auto-save de Contatos
- Confirmado em `bookings/route.ts` e `chatbot.ts`
- Fire-and-forget após criar agendamento
- Não duplica (verifica phone antes de inserir)
- Teste E2E: `e2e/api/03-autosave-contacts.spec.ts`

### 🛡️ Fail-safe de Notificações
- `src/lib/email/safe-send.ts` — retry 2× com backoff 500ms/1000ms + timeout 30s
- `src/lib/whatsapp/safe-send.ts` — mesma lógica
- `bookings/route.ts` — usa safe wrappers com `onFailure` → `notification_logs`
- Teste E2E: `e2e/failsafe/01-email-resilience.spec.ts`

### 🔄 Idempotência Anti-duplicatas
- `bookings/route.ts` — janela de 5 min (mesmo `prof_id + service_id + date + time + phone`)
- Retorna booking existente com 200 em vez de criar duplicado
- Previne: back button, double tab, retry de rede
- Teste E2E: `e2e/critical/03-back-refresh.spec.ts`

### ✅ Validação de Dados + XSS
- `src/lib/validation/booking-schema.ts` — Zod schema completo
- `sanitizeString()` — strip HTML tags (XSS básico)
- `bookings/route.ts` — parse → sanitize → validate → submit
- `payment_intent_id` adicionado como campo opcional
- Teste E2E: `e2e/validation/01-malformed-data.spec.ts` (7 testes)

### ⚡ Performance
- `next.config.ts` — `remotePatterns` para Supabase Storage (imagens otimizadas)
- `hero.tsx` — `<Image fill priority>` para LCP (cover image)
- `section-about.tsx` — `<Image fill>` para about image
- `analytics-dashboard.tsx` — `next/dynamic` com `ssr: false` para todos os gráficos
- Teste E2E: `e2e/performance/01-basic-speed.spec.ts`

### 🎭 Playwright — Novos Projetos
- `performance` — testes de tempo de carga e console errors
- `failsafe` — testes de resiliência de notificações
- `validation` — testes de validação de dados
- `payment` — testes de fluxo de pagamento Stripe

---

## [1.0.0] — 2026-02-13 (baseline)

### Funcionalidades base
- Página pública por profissional (`/[slug]`)
- Agendamento online com calendário e slots de horário
- Dashboard com gestão de serviços, horários e agendamentos
- WhatsApp Bot (Anthropic Claude) — agendar, reagendar, cancelar
- Bloqueio de períodos (férias, feriados)
- CRM básico de clientes e contactos
- Analytics de receita e serviços
- Campanhas WhatsApp
- Automações de lembretes
- Sistema de notificações (email + WhatsApp)
- Multi-tenant com RLS (Row Level Security)
- CI com 18 jobs verdes (Playwright + GitHub Actions)
- Race condition prevention (unique constraint + check)
- Cross-browser: Chrome, Safari, Firefox
- Mobile responsivo
