# Checklist de Teste E2E Manual

> Testes manuais dos fluxos implementados em **2026-02-25**.
> Marque cada item conforme testa. Use os blocos SQL para verificar o estado do banco no Supabase Studio.

---

## Páginas Legais

**URL base:** `https://circlehood-booking.vercel.app`

- [ ] Acessar `/pt-BR/privacy` — título "Política de Privacidade", conteúdo em português
- [ ] Acessar `/en-US/privacy` — título "Privacy Policy", conteúdo em inglês
- [ ] Acessar `/es-ES/privacy` — título "Política de Privacidad", conteúdo em espanhol
- [ ] Acessar `/pt-BR/terms` — título "Termos de Uso", conteúdo em português
- [ ] Acessar `/en-US/terms` — título "Terms of Use", conteúdo em inglês
- [ ] Acessar `/es-ES/terms` — título "Términos de Uso", conteúdo em espanhol
- [ ] Links no footer da página pública apontam para `/pt-BR/privacy` e `/pt-BR/terms`
- [ ] Botão "Voltar ao início" em cada página leva à home

> Verificação: nenhum dado é gravado no banco para estas páginas (são estáticas).

---

## Registro — Aceite de Termos

**Fluxo:** `/pt-BR/register` → preencher step 1 → step 2

- [ ] Checkbox "Li e aceito os Termos de Uso e a Política de Privacidade" aparece no step 2
- [ ] Tentar registrar sem marcar o checkbox → mensagem de erro aparece abaixo do checkbox
- [ ] Links "Termos de Uso" e "Política de Privacidade" no checkbox abrem as páginas corretas em nova aba
- [ ] Marcar o checkbox e concluir → registro funciona normalmente

**SQL — verificar que profissional foi criado:**

```sql
-- Substituir pelo e-mail usado no teste
SELECT id, business_name, created_at, is_active
FROM professionals
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'seu-email@teste.com'
);
```

---

## Exclusão de Conta (GDPR Art. 17)

**Fluxo:** Dashboard → Configurações → rolar até "Zona de Perigo"

- [ ] Seção "Zona de Perigo" aparece no final da página de Configurações com fundo vermelho claro
- [ ] Botão "Excluir minha conta" abre step de confirmação (step 1 → aviso; step 2 → campo de texto)
- [ ] Step 2 pede para digitar a palavra **EXCLUIR** (em maiúsculas) — campo recusa outro texto
- [ ] Digitar "EXCLUIR" e confirmar → solicitação é enviada
- [ ] Após confirmação: banner amarelo aparece no topo do dashboard com data da exclusão (30 dias)
- [ ] Banner contém botão "Cancelar exclusão"
- [ ] Clicar em "Cancelar exclusão" → banner desaparece, conta volta ao normal
- [ ] E-mail de confirmação de exclusão chega na caixa de entrada
- [ ] E-mail de cancelamento chega após cancelar

**SQL — verificar estado da conta após solicitar exclusão:**

```sql
SELECT
  id,
  business_name,
  is_active,
  deleted_at,
  deletion_scheduled_for,
  -- deletion_scheduled_for deve ser deleted_at + 30 dias
  (deletion_scheduled_for - deleted_at) AS grace_period
FROM professionals
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'seu-email@teste.com'
);
```

**SQL — verificar que cancelamento limpou os campos:**

```sql
SELECT
  id,
  is_active,      -- deve ser true
  deleted_at,     -- deve ser NULL
  deletion_scheduled_for  -- deve ser NULL
FROM professionals
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'seu-email@teste.com'
);
```

> ⚠️ **Não testar a exclusão definitiva em produção.** O cron `process-deletions` roda às 03:00 e apaga dados permanentemente quando `deletion_scheduled_for <= now()`.

---

## Exportação de Dados (GDPR Art. 20)

**Fluxo:** Dashboard → Configurações → seção "Meus dados"

- [ ] Card "Exportar meus dados" aparece nas Configurações (acima da Zona de Perigo)
- [ ] Botão "Baixar meus dados" mostra spinner enquanto processa
- [ ] Download dispara automaticamente — arquivo nomeado `circlehood-data-export-YYYY-MM-DD.json`
- [ ] Abrir o JSON e verificar que contém as chaves:

  ```json
  {
    "exportedAt": "...",
    "professional": { ... },
    "services": [ ... ],
    "bookings": [ ... ],
    "contacts": [ ... ],
    "working_hours": [ ... ],
    "blocked_dates": [ ... ],
    "blocked_periods": [ ... ],
    "page_sections": [ ... ],
    "testimonials": [ ... ]
  }
  ```

- [ ] `professional` não contém `stripe_customer_id` nem `stripe_subscription_id`
- [ ] `bookings` lista agendamentos reais do profissional
- [ ] Chamar a rota diretamente confirma os dados:

```bash
# Substitua SEU_TOKEN pelo Bearer token da sessão (F12 → Network → qualquer request autenticado)
curl -s "https://circlehood-booking.vercel.app/api/account/export-data" \
  -H "Authorization: Bearer SEU_TOKEN" \
  | python3 -m json.tool | head -60
```

---

## Import de Contatos via WhatsApp

**Pré-requisito:** Evolution API configurada e conectada em `/dashboard/whatsapp-config`

**Fluxo:** Dashboard → Clientes → Importar

- [ ] Se Evolution configurada: botão verde "Importar do WhatsApp" aparece na página de Importação
- [ ] Se WhatsApp não configurado (ou provider = Meta): botão **não** aparece
- [ ] Clicar em "Importar do WhatsApp" → mostra spinner durante importação
- [ ] Toast de sucesso exibe: `"X contatos importados, Y ignorados (duplicatas)"`
- [ ] Toast de erro aparece se Evolution API estiver offline

**SQL — verificar contatos importados:**

```sql
SELECT
  name,
  phone,
  source,
  created_at
FROM contacts
WHERE professional_id = '<seu-professional-id>'
  AND source = 'whatsapp'
ORDER BY created_at DESC
LIMIT 20;
```

**SQL — verificar ausência de duplicatas:**

```sql
-- Não deve retornar nenhuma linha
SELECT phone, COUNT(*) AS duplicates
FROM contacts
WHERE professional_id = '<seu-professional-id>'
GROUP BY phone
HAVING COUNT(*) > 1;
```

---

## Bot WhatsApp — Resposta a Áudio

**Pré-requisito:** Evolution API conectada; WhatsApp do cliente configurado como bot ativo

- [ ] Enviar uma mensagem de **texto** pelo WhatsApp → bot responde normalmente, sem duplicação
- [ ] Enviar uma **nota de voz (PTT)** → bot responde com:
  > *"Desculpe, ainda não consigo ouvir áudios 🎙️ Por favor, envie sua mensagem por texto e ficarei feliz em ajudar! 😊"*
- [ ] Enviar um **arquivo de áudio** (mp3/ogg) → mesma resposta educada
- [ ] Verificar nos logs da Vercel que NÃO há múltiplas chamadas para a mesma mensagem (sem loop)

**SQL — verificar mensagens na conversa (sem duplicatas):**

```sql
-- Substituir pelo número do telefone do cliente (formato internacional, sem +)
SELECT
  m.direction,
  m.message,
  m.created_at,
  -- Checar se há timestamps muito próximos (< 5s) = duplicata
  LAG(m.created_at) OVER (PARTITION BY m.conversation_id ORDER BY m.created_at) AS prev_ts,
  EXTRACT(EPOCH FROM (m.created_at - LAG(m.created_at) OVER (
    PARTITION BY m.conversation_id ORDER BY m.created_at
  ))) AS seconds_since_prev
FROM whatsapp_messages m
JOIN whatsapp_conversations c ON c.id = m.conversation_id
WHERE c.client_phone LIKE '%5511%'  -- ajustar para o número do teste
ORDER BY m.created_at DESC
LIMIT 30;
```

**SQL — verificar que deduplicação Redis funcionou (sem mensagem processada 2x):**

```sql
-- Se houver mensagem duplicada, created_at das mensagens do bot serão muito próximos
SELECT
  direction,
  message,
  created_at
FROM whatsapp_messages
WHERE conversation_id = (
  SELECT id FROM whatsapp_conversations
  WHERE client_phone LIKE '%5511%'
  ORDER BY created_at DESC LIMIT 1
)
  AND direction = 'outbound'
ORDER BY created_at DESC
LIMIT 10;
```

---

## Bot WhatsApp — Sem Loop de Boas-Vindas

**Cenário:** primeira mensagem enviada por um cliente novo

- [ ] Enviar "Oi" → bot responde **uma única vez** com a saudação
- [ ] Esperar 10 segundos → **nenhuma** mensagem adicional chega
- [ ] Verificar no Supabase que há exatamente 1 mensagem de entrada e 1 de saída

**SQL — contar mensagens por direção:**

```sql
SELECT
  direction,
  COUNT(*) AS total
FROM whatsapp_messages
WHERE conversation_id = (
  SELECT id FROM whatsapp_conversations
  WHERE client_phone LIKE '%NUMERO_DO_TESTE%'
  ORDER BY created_at DESC LIMIT 1
)
GROUP BY direction;
-- Esperado: inbound = 1, outbound = 1
```

---

## Lembrete de Manutenção (cron)

**Pré-requisito:** agendamento com `status='completed'` e serviço com `lifetime_days` preenchido

- [ ] Verificar que `maintenance_reminder_sent = false` antes de disparar o cron
- [ ] Chamar o cron manualmente:

```bash
curl -s -X POST "https://circlehood-booking.vercel.app/api/cron/send-maintenance-reminders" \
  -H "Authorization: Bearer SEU_CRON_SECRET" \
  | python3 -m json.tool
```

- [ ] Mensagem chega em português para número +55 (Brasil)
- [ ] Mensagem chega em inglês para número de outro país

**SQL — ver candidatos ao lembrete:**

```sql
SELECT
  b.id,
  b.client_name,
  b.client_phone,
  b.completed_at,
  s.name AS service,
  s.lifetime_days,
  -- Data prevista para o lembrete
  (b.completed_at::date + s.lifetime_days * INTERVAL '1 day')::date AS reminder_due,
  b.maintenance_reminder_sent
FROM bookings b
JOIN services s ON s.id = b.service_id
WHERE b.status = 'completed'
  AND b.maintenance_reminder_sent = false
  AND s.lifetime_days IS NOT NULL
  AND b.completed_at IS NOT NULL
ORDER BY reminder_due ASC;
```

**SQL — verificar log do cron após execução:**

```sql
SELECT
  job_name,
  status,
  records_processed,
  execution_time_ms,
  metadata,
  created_at
FROM cron_logs
WHERE job_name = 'send-maintenance-reminders'
ORDER BY created_at DESC
LIMIT 5;
```

---

## Resumo de Status

| Área | Resultado | Observações |
|------|-----------|-------------|
| Páginas legais (PT/EN/ES) | ⬜ | |
| Registro com aceite de termos | ⬜ | |
| Exclusão de conta GDPR Art. 17 | ⬜ | |
| Exportação de dados GDPR Art. 20 | ⬜ | |
| Import WhatsApp (Evolution) | ⬜ | |
| Bot — resposta a áudio | ⬜ | |
| Bot — sem loop de mensagens | ⬜ | |
| Lembrete de manutenção (cron) | ⬜ | |

**Legenda:** ⬜ Não testado · ✅ Passou · ❌ Falhou · ⚠️ Passou com ressalva
