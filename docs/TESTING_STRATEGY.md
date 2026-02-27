# Testing Strategy — CircleHood Booking

## Por que separamos os testes?

Os testes do bot WhatsApp chamam a **Claude API** (Anthropic) e a **Evolution API**. Cada execução tem custo real em créditos de API. Se um teste de UI simples já falhou, não faz sentido gastar esses créditos.

**Regra principal:** testes caros só rodam se todos os baratos passaram.

---

## Pipeline CI/CD

### Fluxo de dependências

```
unit (Vitest)
    │
    ├── smoke (cross-browser)
    ├── dashboard-e2e
    ├── api-e2e
    ├── security-e2e
    ├── user-journey-e2e
    ├── navigation-e2e
    ├── ux-e2e
    ├── i18n-e2e
    ├── notifications-e2e
    ├── mobile-e2e
    ├── critical-race
    ├── critical-idempotency
    ├── gdpr-legal-e2e
    ├── payment-e2e
    ├── timezone-dst
    └── blocked-periods-api
             │
             └── bot-e2e 💰 (só roda se TODOS acima passarem)
                      │
                      └── bot-reschedule 💰
                               │
                               └── blocked-periods-bot 💰
                                        │
                                        └── consistency-bot-page 💰
```

### Tempo e custo estimado por stage

| Stage | Jobs | Tempo | Custo API | Quando para? |
|-------|------|-------|-----------|--------------|
| Unit (Vitest) | 1 | ~30s | €0.00 | unit falha |
| E2E baratos | 16 em paralelo | ~5-8 min | ~€0.01 | qualquer falha |
| Bot chain | 4 em série | ~10-15 min | ~€0.15-0.30 | só após todos passarem |
| **Total feliz** | 21 | ~20 min | ~€0.16 | — |
| **Falha early (unit)** | 1 | ~30s | €0.00 | economiza ~€0.16 |
| **Falha mid (E2E)** | 17 | ~8 min | ~€0.01 | economiza ~€0.15 |

### Economias típicas

- Falha em lint/unit → **para imediatamente**, economiza 100% dos custos bot
- Falha em E2E não-bot → economiza os ~€0.20 da chain do bot
- Só o bot é caro → nunca paga por ele se o resto está quebrado

---

## Projetos Playwright e o que testam

### Projetos baratos (sem API externa)
| Projeto | Arquivo(s) | Custo |
|---------|------------|-------|
| `smoke-chromium/webkit/firefox` | `e2e/dashboard/01-smoke.spec.ts` | €0.00 |
| `dashboard` | `e2e/dashboard/*.spec.ts` | €0.00 |
| `api-tests` | `e2e/api/*.spec.ts` | €0.00 |
| `security` | `e2e/security/*.spec.ts` | €0.00 |
| `user-journey` | `e2e/user-journey/*.spec.ts` | €0.00 |
| `navigation` | `e2e/navigation/*.spec.ts` | €0.00 |
| `ux` | `e2e/ux/*.spec.ts` | €0.00 |
| `i18n` | `e2e/i18n/*.spec.ts` | €0.00 |
| `notifications` | `e2e/notifications/*.spec.ts` | €0.00 |
| `mobile` | `e2e/mobile/*.spec.ts` | €0.00 |
| `critical-race` | `e2e/critical/02-race-condition.spec.ts` | €0.00 |
| `critical-idempotency` | `e2e/critical/01-idempotency.spec.ts` | €0.00 |
| `legal` + `gdpr` | `e2e/legal-pages.spec.ts`, `e2e/gdpr-account.spec.ts` | €0.00 |
| `payment` | `e2e/payment/*.spec.ts` | €0.00 |
| `timezone-dst` | `e2e/timezone/*.spec.ts` | €0.00 |
| `blocked-periods-api` | `e2e/blocked-periods/01-api.spec.ts` | €0.00 |

### Projetos caros (chamam Claude API + Evolution API) 💰
| Projeto | Arquivo(s) | Custo estimado |
|---------|------------|----------------|
| `bot-api` | `e2e/bot/01-greeting.spec.ts`, `02-day-validation.spec.ts`, `03-booking-flow.spec.ts`, `04-slot-conflict.spec.ts` | ~€0.05-0.10 |
| `bot-reschedule` | `e2e/bot/06-reschedule.spec.ts` | ~€0.03-0.05 |
| `blocked-periods-bot` | `e2e/blocked-periods/02-bot.spec.ts` | ~€0.03-0.05 |
| `consistency-bot-page` | `e2e/consistency/01-bot-vs-page.spec.ts` | ~€0.03-0.05 |

---

## Como adicionar novos testes

### Teste barato (sem chamada a API externa)

1. Crie o arquivo em `e2e/<categoria>/`.
2. Adicione ao `playwright.config.ts` como novo projeto (se nova categoria).
3. Adicione o job no CI com `needs: unit` (para rodar em paralelo com os outros baratos).
4. Adicione o novo job na lista `needs` do `bot-e2e`.

```yaml
# ci.yml — exemplo de novo job barato
meu-novo-teste:
  name: Playwright (meu novo teste)
  runs-on: ubuntu-latest
  environment: test
  needs: unit          # ← só depende de unit
  steps:
    # ...
    - run: npx playwright test --project=meu-projeto

# E adicionar em bot-e2e.needs:
bot-e2e:
  needs:
    - unit
    # ... todos os outros ...
    - meu-novo-teste   # ← bot só roda após esse também passar
```

### Teste caro (chama Claude API ou Evolution API)

1. Crie o arquivo em `e2e/bot/` ou `e2e/blocked-periods/`.
2. Adicione ao `playwright.config.ts` no grupo de projetos bot.
3. **Encadeie após o último job bot** (`needs: [unit, consistency-bot-page]`) — os testes bot compartilham o telefone de teste e NÃO podem rodar em paralelo.
4. Adicione na lista `needs` do `cleanup-test-db`.

---

## Como rodar localmente

### Apenas testes unitários (mais rápido)
```bash
npm run test:unit
# ou
npm test
```

### Apenas E2E baratos (sem gastar créditos bot)
```bash
npm run test:e2e:no-bot
```

### Apenas bot (quando debugar o bot especificamente)
```bash
npm run test:e2e:bot-only
```

### Todos os E2E
```bash
npm run test:e2e
```

### Verificação rápida antes de commitar
```bash
npm run test:fast   # vitest + lint (~30s)
```

---

## Variáveis de ambiente necessárias

### Todos os jobs
| Secret | Descrição |
|--------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do Supabase de teste |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypassa RLS) |

### Jobs bot (extras)
| Secret | Descrição |
|--------|-----------|
| `REDIS_URL` | Redis para deduplicação de mensagens |
| `CRON_SECRET` | Autenticação dos endpoints cron |

### Jobs autenticados (extras)
| Secret | Descrição |
|--------|-----------|
| `TEST_USER_EMAIL` | Email do profissional de teste |
| `TEST_USER_PASSWORD` | Senha do profissional de teste |

---

## Telefone de teste do bot

O bot usa o número `353830326180` como cliente de teste. **Todos os jobs bot compartilham esse número** e por isso são serializados (não paralelos). Rodar em paralelo causaria interferência entre conversas.

O cleanup ao final apaga todas as conversas desse número na tabela `whatsapp_conversations`.
