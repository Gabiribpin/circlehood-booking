# Auditoria Técnica Pré-Lançamento — CircleHood Booking

**Data:** 05/03/2026
**Commit:** main @ `e37b02d`
**Auditor:** Claude Code (Anthropic)
**Escopo:** Varredura completa de 108 API routes, 76 migrations, 50+ tabelas, frontend, infra

---

## VEREDITO FINAL

### ❌ NÃO PRONTO PARA LANÇAMENTO (ainda)

### ⚠️ PRONTO PARA BETA após corrigir 6 blockers (~7h)

---

## Estatísticas

| Severidade | Quantidade | Issues |
|---|---|---|
| BLOCKER (P0) | 6 | #181-#186 |
| CRITICAL (P1) | 6 | #187-#192 |
| HIGH (P2) | 8 | #193-#201 |
| MEDIUM (P3) | 5 | #202-#207 |
| LOW (P4) | 3 | #208-#210 |
| **Total** | **28** | |

---

## BLOQUEADORES (P0) — Impedem lançamento

| # | Issue | Problema | Esforço |
|---|---|---|---|
| 1 | [#181](https://github.com/Gabiribpin/circlehood-booking/issues/181) | `/api/translate` sem auth — proxy AI aberto, risco financeiro | 1h |
| 2 | [#182](https://github.com/Gabiribpin/circlehood-booking/issues/182) | `/api/optimize-route` sem auth — expõe PII de clientes | 1h |
| 3 | [#183](https://github.com/Gabiribpin/circlehood-booking/issues/183) | `/api/payment/create-intent` sem auth — PaymentIntents arbitrários | 2h |
| 4 | [#184](https://github.com/Gabiribpin/circlehood-booking/issues/184) | Webhook whatsapp-support sem validação de assinatura | 30min |
| 5 | [#185](https://github.com/Gabiribpin/circlehood-booking/issues/185) | Trigger loyalty stamp referencia tabela dropada — crash em "concluir" | 1h |
| 6 | [#186](https://github.com/Gabiribpin/circlehood-booking/issues/186) | `global-error.tsx` não existe — crash = tela branca | 1h |

**Total blockers: ~7 horas**

---

## CRÍTICOS (P1) — Antes de beta

| # | Issue | Problema | Esforço |
|---|---|---|---|
| 7 | [#187](https://github.com/Gabiribpin/circlehood-booking/issues/187) | `reschedule_tokens` RLS USING(true) — tokens expostos publicamente | 1h |
| 8 | [#188](https://github.com/Gabiribpin/circlehood-booking/issues/188) | Email unsubscribe não commitado — risco LGPD | 2h |
| 9 | [#189](https://github.com/Gabiribpin/circlehood-booking/issues/189) | Rate limit ausente em register/signup | 1h |
| 10 | [#190](https://github.com/Gabiribpin/circlehood-booking/issues/190) | integrations/instagram_posts RLS policy sempre false | 1h |
| 11 | [#191](https://github.com/Gabiribpin/circlehood-booking/issues/191) | Calendar trigger ON CONFLICT sem unique constraint | 30min |
| 12 | [#192](https://github.com/Gabiribpin/circlehood-booking/issues/192) | Google Calendar connect sem autenticação | 30min |

**Total critical: ~6 horas**

---

## ALTOS (P2) — Primeira semana

| # | Issue | Problema | Esforço |
|---|---|---|---|
| 13 | [#193](https://github.com/Gabiribpin/circlehood-booking/issues/193) | Instagram callback usa user.id como professional_id | 30min |
| 14 | [#194](https://github.com/Gabiribpin/circlehood-booking/issues/194) | reschedule/change usa session client | 15min |
| 15 | [#195](https://github.com/Gabiribpin/circlehood-booking/issues/195) | booking-section.tsx 100% PT-BR hardcoded | 3h |
| 16 | [#196](https://github.com/Gabiribpin/circlehood-booking/issues/196) | Componentes públicos sem i18n (4 arquivos) | 2h |
| 17 | [#197](https://github.com/Gabiribpin/circlehood-booking/issues/197) | Auth pages parcialmente hardcoded PT-BR | 2h |
| 18 | [#198](https://github.com/Gabiribpin/circlehood-booking/issues/198) | validateServerEnv() nunca chamada — falta instrumentation.ts | 30min |
| 19 | [#199](https://github.com/Gabiribpin/circlehood-booking/issues/199) | Icon buttons sem aria-label (7+ locais) | 1h |
| 20 | [#200](https://github.com/Gabiribpin/circlehood-booking/issues/200) | payments ON DELETE CASCADE destroi histórico | 30min |
| -- | [#201](https://github.com/Gabiribpin/circlehood-booking/issues/201) | GET /api/auth/signout CSRF via img tag | 15min |

**Total high: ~10 horas**

---

## MÉDIOS (P3) — Primeiro mês

| # | Issue | Problema | Esforço |
|---|---|---|---|
| 21 | [#202](https://github.com/Gabiribpin/circlehood-booking/issues/202) | Index faltando em bookings.service_id | 15min |
| 22 | [#203](https://github.com/Gabiribpin/circlehood-booking/issues/203) | not-found.tsx hardcoded PT-BR + root 404 ausente | 1h |
| 23 | [#204](https://github.com/Gabiribpin/circlehood-booking/issues/204) | Dashboard components sem i18n (3 arquivos) | 2h |
| 24 | [#205](https://github.com/Gabiribpin/circlehood-booking/issues/205) | Secrets parciais hardcoded no admin handbook | 30min |
| 25 | [#206](https://github.com/Gabiribpin/circlehood-booking/issues/206) | Crons duplicados e redundantes | 30min |
| -- | [#207](https://github.com/Gabiribpin/circlehood-booking/issues/207) | 14 routes sem try/catch | 2h |

**Total medium: ~6 horas**

---

## BAIXOS (P4) — Backlog

| # | Issue | Problema | Esforço |
|---|---|---|---|
| 26 | [#208](https://github.com/Gabiribpin/circlehood-booking/issues/208) | Views DB com colunas inexistentes | 30min |
| 27 | [#209](https://github.com/Gabiribpin/circlehood-booking/issues/209) | Error.tsx faltando para auth/public/admin groups | 1h |
| 28 | [#210](https://github.com/Gabiribpin/circlehood-booking/issues/210) | Rate limit em testimonials/waitlist públicos | 1h |

---

## O que FUNCIONA bem

| Área | Status |
|---|---|
| Cadastro + Login + OAuth | ✅ Completo |
| CRUD de serviços | ✅ Completo |
| Booking flow (5 steps) | ✅ Completo (idempotência, race protection, validação Zod) |
| WhatsApp Bot (5 tools) | ✅ Completo (3-tier cache, retry, language detection) |
| Schedule management | ✅ Completo (horários + bloqueios + períodos) |
| Analytics (4 routes) | ✅ Completo (live computation, CSV export) |
| Email notifications | ✅ Completo (6 tipos via Resend) |
| GDPR/Delete account | ✅ Completo (anonymização, retention emails) |
| Stripe subscription | ✅ Completo (checkout, webhook, portal) |
| Termos + Privacy | ✅ Existem (traduzidos) |
| i18n dashboard | ✅ 21 componentes traduzidos |
| Admin panel | ✅ Completo (support, inbox, control center) |
| RLS core tables | ✅ Sólido (padrão professional_id subquery) |
| Testes | ✅ 1048/1050 unit, 28/29 E2E |
| Dependências | ✅ 0 vulnerabilidades |
| Logger | ✅ Production-safe (info/log silenciados) |

---

## Métricas de Cobertura

| Métrica | Valor |
|---|---|
| Unit tests | 1048/1050 (99.8%) |
| E2E tests | 28/29 (96.5%) |
| API routes auditadas | 108/108 (100%) |
| Routes com auth | 95/108 (88%) — 5 sem auth que precisam, 8 intencionalmente públicas |
| Routes com rate limit | 3/108 (2.8%) — gap significativo |
| Tables com RLS | 47/50 (94%) — 3 admin-only sem RLS (intencional) |
| Vulnerabilidades npm | 0 |

---

## Plano de Ação

### Fase 1 — BLOCKERS (1 dia, ~7h)

**Manhã:**
- [ ] #181: Auth em /api/translate (1h)
- [ ] #182: Auth em /api/optimize-route (1h)
- [ ] #184: Validação webhook whatsapp-support (30min)
- [ ] #186: Criar global-error.tsx (1h)

**Tarde:**
- [ ] #183: Validação server-side em /api/payment/create-intent (2h)
- [ ] #185: Fix trigger loyalty stamp (1h)

**CHECKPOINT:** `test:fast` + CI verde → deploy staging → smoke test

### Fase 2 — CRITICAL (2-3 dias, ~6h)

- [ ] #187: Fix reschedule_tokens RLS (1h)
- [ ] #188: Commit email unsubscribe + apply migration (2h)
- [ ] #189: Rate limit em register (1h)
- [ ] #190: Fix integrations/instagram RLS policies (1h)
- [ ] #191: Unique constraint calendar_events.booking_id (30min)
- [ ] #192: Auth em Google Calendar connect (30min)

**CHECKPOINT:** CI verde → **LANÇAR BETA** (5-10 profissionais)

### Fase 3 — HIGH (primeira semana, ~10h)

- [ ] #193-#194: Bug fixes (45min)
- [ ] #195-#197: i18n componentes públicos e auth (7h)
- [ ] #198-#201: instrumentation.ts, a11y, cascade, CSRF (2h15)

### Fase 4 — MEDIUM + LOW (primeiro mês, ~9h)

- [ ] #202-#210: Indexes, crons, try/catch, views, error boundaries

---

## Timeline Realista

| Marco | Data estimada | Requisitos |
|---|---|---|
| Blockers corrigidos | 06/03/2026 | 6 issues P0 fechadas |
| Beta launch | 10/03/2026 | P0 + P1 fechados, CI verde |
| Estabilização | 17/03/2026 | P2 corrigidos, feedback beta |
| GA launch | 31/03/2026 | P0-P3 fechados, docs prontos |

---

**Assinatura:** Claude Code (Anthropic)
**Data:** 05/03/2026
**Commit auditado:** `e37b02d` (main)
