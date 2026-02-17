# 🤖 SPRINT 7 - AUTOMAÇÕES - ARQUITETURA TÉCNICA

**Data:** 17 de Fevereiro de 2026
**Duração Estimada:** 1 semana (5 dias úteis)
**Arquiteto:** Claude Code
**Projeto:** CircleHood Booking

---

## 🎯 OBJETIVOS DO SPRINT

Automatizar processos críticos de comunicação e gestão de agendamentos para:
1. Reduzir trabalho manual do profissional
2. Melhorar experiência do cliente
3. Aumentar taxa de comparecimento (reduzir no-shows)
4. Otimizar ocupação dos horários disponíveis

---

## 📊 FUNCIONALIDADES

### 1. Vercel Cron Jobs ⏰
**Problema:** Lembretes e notificações enviados manualmente
**Solução:** Cron jobs automatizados executando diariamente

**Cron Jobs:**
- **Lembretes de Agendamento:** Executa todo dia às 10h (UTC), envia lembretes para bookings de amanhã
- **Refresh Materialized View:** Executa todo dia à meia-noite, atualiza analytics cache
- **Cleanup Expired Tokens:** Executa todo dia às 2h, limpa tokens expirados de reagendamento

### 2. Lembretes Automáticos 📱
**Fluxo:**
1. Cron job identifica bookings confirmados de amanhã
2. Verifica se lembrete já foi enviado (`reminder_sent: false`)
3. Gera mensagem personalizada por idioma do contato
4. Marca como `reminder_sent: true`
5. Registra em `notification_logs`

**Mensagens por idioma:**
- PT: "Olá {nome}! Lembrando que você tem agendamento amanhã às {hora} para {serviço}. Te espero! 💜"
- EN: "Hi {nome}! Reminder: You have an appointment tomorrow at {hora} for {serviço}. See you! 💜"
- ES: "¡Hola {nome}! Te recuerdo que tienes cita mañana a las {hora} para {serviço}. ¡Nos vemos! 💜"

### 3. Confirmação Automática ✅
**Fluxo:**
1. Cliente cria novo booking na página pública
2. Trigger automático dispara após insert em `bookings`
3. Cria registro em `notification_queue` com tipo "booking_confirmation"
4. API `/api/notifications/send` processa fila a cada 30 segundos
5. Envia confirmação via WhatsApp (wa.me) e Email (Resend)

**Template de confirmação:**
```
✅ Agendamento Confirmado!

Olá {nome},
Seu agendamento foi confirmado com sucesso:

📅 Data: {data}
⏰ Horário: {hora}
✂️ Serviço: {serviço}
💰 Valor: €{preço}
📍 Local: {endereço}

{link_reagendamento}

Nos vemos lá! 💜
```

### 4. Reagendamento pelo Cliente 🔄
**Problema:** Cliente precisa ligar/mensagem para cancelar/reagendar
**Solução:** Link único e seguro enviado na confirmação

**Arquitetura:**
- Tabela `reschedule_tokens` com token UUID único
- TTL de 30 dias (expiração automática)
- Link: `circlehood.app/reschedule/{token}`
- Página permite:
  - Ver detalhes do agendamento atual
  - Cancelar com motivo opcional
  - Reagendar para novo horário disponível
  - Notifica profissional automaticamente

**Segurança:**
- Token único não-adivinável (UUID v4)
- Expiração automática após uso ou 30 dias
- Rate limiting (máx 10 tentativas/hora por IP)
- Valida que booking ainda está ativo

### 5. Lista de Espera 📋
**Problema:** Cliente quer agendar mas horário está cheio
**Solução:** Sistema de waitlist com notificação automática

**Fluxo:**
1. Cliente tenta agendar mas horário indisponível
2. Botão "Entrar na Lista de Espera" aparece
3. Cliente preenche: nome, telefone, email, datas preferidas
4. Registro criado em `waitlist`
5. Quando booking é cancelado → Trigger dispara
6. Notifica primeiro da waitlist (FIFO) via WhatsApp
7. Cliente tem 24h para confirmar, senão passa pro próximo

**Priorização:**
- FIFO (First In, First Out)
- Filtro por serviço específico
- Filtro por faixa de datas preferidas

### 6. Notificação Automática de Vagas 🔔
**Trigger PostgreSQL:**
```sql
CREATE OR REPLACE FUNCTION notify_waitlist_on_cancellation()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'confirmed' AND NEW.status = 'cancelled' THEN
    -- Buscar primeiro da waitlist para este serviço e data
    INSERT INTO notification_queue (type, data)
    SELECT 'waitlist_available',
           jsonb_build_object(
             'waitlist_id', w.id,
             'booking_date', NEW.booking_date,
             'booking_time', NEW.booking_time,
             'service_id', NEW.service_id
           )
    FROM waitlist w
    WHERE w.professional_id = NEW.professional_id
      AND w.service_id = NEW.service_id
      AND NEW.booking_date = ANY(w.preferred_dates)
      AND w.notified = false
    ORDER BY w.created_at ASC
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 7. Pacotes de Serviços 📦
**Objetivo:** Permitir combos com desconto

**Estrutura:**
```typescript
interface ServicePackage {
  id: string
  professional_id: string
  name: string  // "Beleza Completa"
  description: string
  services: string[]  // Array de service_ids
  original_price: number  // Soma dos serviços individuais
  package_price: number  // Preço com desconto
  discount_percent: number  // Calculado automaticamente
  is_active: boolean
  duration_minutes: number  // Soma das durações
}
```

**Interface:**
- CRUD de pacotes no dashboard
- Cliente vê pacotes destacados na página pública
- Badge "Economize €X" mostrando desconto
- Agendamento de pacote bloqueia múltiplos horários sequenciais

### 8. Programa de Fidelidade 🎁
**Mecânica:**
- A cada serviço completo → +1 carimbo
- A cada 10 carimbos → 1 serviço grátis
- Cartão digital visual mostrando progresso
- Cliente acessa via link único

**Tabela `loyalty_cards`:**
```sql
CREATE TABLE loyalty_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id),
  contact_id uuid REFERENCES imported_contacts(id),
  current_stamps integer DEFAULT 0,
  total_stamps integer DEFAULT 0,
  rewards_redeemed integer DEFAULT 0,
  card_token text UNIQUE,  -- Link único do cartão
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
```

**Trigger automático:**
- Quando booking status = 'completed' → +1 stamp
- Quando stamps atingem 10 → Notifica cliente de recompensa disponível
- Cliente agenda serviço grátis usando código de resgate

---

## 🗄️ SCHEMA DE BANCO DE DADOS

### Novas Tabelas

#### 1. `notification_queue`
```sql
CREATE TABLE notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id),
  type text NOT NULL,  -- 'booking_confirmation', 'reminder', 'waitlist_available'
  recipient_name text NOT NULL,
  recipient_phone text NOT NULL,
  recipient_email text,
  message_template text NOT NULL,
  message_data jsonb NOT NULL,
  language text DEFAULT 'pt',
  status text DEFAULT 'pending',  -- 'pending', 'sent', 'failed'
  sent_at timestamp,
  error_message text,
  created_at timestamp DEFAULT now()
);

CREATE INDEX idx_notification_queue_status ON notification_queue(status);
CREATE INDEX idx_notification_queue_created ON notification_queue(created_at);
```

#### 2. `notification_logs`
```sql
CREATE TABLE notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id),
  booking_id uuid REFERENCES bookings(id),
  type text NOT NULL,
  channel text NOT NULL,  -- 'whatsapp', 'email', 'sms'
  recipient text NOT NULL,
  message text NOT NULL,
  status text DEFAULT 'sent',
  created_at timestamp DEFAULT now()
);

CREATE INDEX idx_notification_logs_booking ON notification_logs(booking_id);
CREATE INDEX idx_notification_logs_professional ON notification_logs(professional_id);
```

#### 3. `reschedule_tokens`
```sql
CREATE TABLE reschedule_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) UNIQUE,
  token text UNIQUE NOT NULL,
  expires_at timestamp NOT NULL,
  used boolean DEFAULT false,
  used_at timestamp,
  created_at timestamp DEFAULT now()
);

CREATE INDEX idx_reschedule_tokens_token ON reschedule_tokens(token);
CREATE INDEX idx_reschedule_tokens_expires ON reschedule_tokens(expires_at);
```

#### 4. `waitlist`
```sql
CREATE TABLE waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id),
  service_id uuid REFERENCES services(id),
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  contact_email text,
  preferred_dates date[] NOT NULL,
  preferred_time_slots text[],  -- ['morning', 'afternoon', 'evening']
  notes text,
  notified boolean DEFAULT false,
  notified_at timestamp,
  expires_at timestamp,
  status text DEFAULT 'active',  -- 'active', 'notified', 'expired', 'converted'
  created_at timestamp DEFAULT now()
);

CREATE INDEX idx_waitlist_professional ON waitlist(professional_id);
CREATE INDEX idx_waitlist_service ON waitlist(service_id);
CREATE INDEX idx_waitlist_status ON waitlist(status);
```

#### 5. `service_packages`
```sql
CREATE TABLE service_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id),
  name text NOT NULL,
  description text,
  service_ids uuid[] NOT NULL,
  original_price numeric(10,2) NOT NULL,
  package_price numeric(10,2) NOT NULL,
  discount_percent integer GENERATED ALWAYS AS (
    ROUND(((original_price - package_price) / original_price) * 100)
  ) STORED,
  duration_minutes integer NOT NULL,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX idx_service_packages_professional ON service_packages(professional_id);
CREATE INDEX idx_service_packages_active ON service_packages(is_active);
```

#### 6. `loyalty_cards`
```sql
CREATE TABLE loyalty_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id),
  contact_id uuid REFERENCES imported_contacts(id),
  contact_phone text NOT NULL,
  current_stamps integer DEFAULT 0,
  total_stamps integer DEFAULT 0,
  rewards_available integer DEFAULT 0,
  rewards_redeemed integer DEFAULT 0,
  card_token text UNIQUE NOT NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE(professional_id, contact_id)
);

CREATE INDEX idx_loyalty_cards_professional ON loyalty_cards(professional_id);
CREATE INDEX idx_loyalty_cards_contact ON loyalty_cards(contact_id);
CREATE INDEX idx_loyalty_cards_token ON loyalty_cards(card_token);
```

#### 7. `loyalty_transactions`
```sql
CREATE TABLE loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loyalty_card_id uuid REFERENCES loyalty_cards(id),
  booking_id uuid REFERENCES bookings(id),
  type text NOT NULL,  -- 'stamp_earned', 'reward_redeemed'
  stamps_change integer NOT NULL,
  notes text,
  created_at timestamp DEFAULT now()
);

CREATE INDEX idx_loyalty_transactions_card ON loyalty_transactions(loyalty_card_id);
CREATE INDEX idx_loyalty_transactions_booking ON loyalty_transactions(booking_id);
```

#### 8. `cron_logs`
```sql
CREATE TABLE cron_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  status text NOT NULL,  -- 'success', 'error'
  records_processed integer DEFAULT 0,
  error_message text,
  execution_time_ms integer,
  created_at timestamp DEFAULT now()
);

CREATE INDEX idx_cron_logs_job ON cron_logs(job_name);
CREATE INDEX idx_cron_logs_created ON cron_logs(created_at);
```

### Atualizações em Tabelas Existentes

#### `bookings`
```sql
ALTER TABLE bookings
ADD COLUMN reminder_sent boolean DEFAULT false,
ADD COLUMN reminder_sent_at timestamp,
ADD COLUMN confirmation_sent boolean DEFAULT false,
ADD COLUMN confirmation_sent_at timestamp,
ADD COLUMN package_id uuid REFERENCES service_packages(id),
ADD COLUMN loyalty_reward_used boolean DEFAULT false;
```

---

## 🔌 API ENDPOINTS

### Cron Jobs (Protected by CRON_SECRET)

#### `POST /api/cron/send-reminders`
```typescript
// Executa diariamente às 10h UTC
// Envia lembretes para bookings de amanhã
{
  Authorization: Bearer ${CRON_SECRET}
}

Response: {
  success: true,
  remindersSent: 15,
  errors: []
}
```

#### `POST /api/cron/refresh-analytics`
```typescript
// Executa diariamente à meia-noite UTC
// Atualiza materialized view de analytics
Response: {
  success: true,
  rowsRefreshed: 1
}
```

#### `POST /api/cron/cleanup-tokens`
```typescript
// Executa diariamente às 2h UTC
// Remove tokens expirados
Response: {
  success: true,
  tokensDeleted: 5
}
```

### Notifications

#### `POST /api/notifications/send`
```typescript
// Processa fila de notificações
// Chamado por cron a cada 30 segundos
```

### Reschedule

#### `GET /api/reschedule/[token]`
```typescript
// Valida token e retorna dados do booking
Response: {
  valid: true,
  booking: { ... },
  professional: { ... }
}
```

#### `POST /api/reschedule/[token]/cancel`
```typescript
Body: {
  reason: string
}
Response: {
  success: true,
  message: "Agendamento cancelado"
}
```

#### `POST /api/reschedule/[token]/change`
```typescript
Body: {
  new_date: string,
  new_time: string
}
Response: {
  success: true,
  booking: { ... }
}
```

### Waitlist

#### `POST /api/waitlist`
```typescript
Body: {
  professional_id: string,
  service_id: string,
  contact_name: string,
  contact_phone: string,
  contact_email: string,
  preferred_dates: string[],
  preferred_time_slots: string[]
}
```

#### `GET /api/waitlist` (Professional only)
```typescript
// Lista waitlist do profissional
Response: {
  waitlist: [...]
}
```

#### `POST /api/waitlist/[id]/notify`
```typescript
// Notifica manualmente pessoa da waitlist
```

### Service Packages

#### `GET /api/packages`
```typescript
// Lista pacotes ativos (público)
// Filtra por professional_id
```

#### `POST /api/packages` (Professional only)
```typescript
Body: {
  name: string,
  description: string,
  service_ids: string[],
  package_price: number
}
```

#### `PUT /api/packages/[id]`
#### `DELETE /api/packages/[id]`

### Loyalty

#### `GET /api/loyalty/card/[token]`
```typescript
// Visualização pública do cartão de fidelidade
Response: {
  card: {
    current_stamps: 8,
    total_stamps: 23,
    rewards_available: 2,
    next_reward_in: 2
  },
  professional: { ... }
}
```

#### `GET /api/loyalty/cards` (Professional only)
```typescript
// Lista todos os cartões de fidelidade
Response: {
  cards: [...]
}
```

---

## 🎨 COMPONENTES FRONTEND

### Dashboard Components

#### `/app/(dashboard)/automations/page.tsx`
Central de automações com:
- Toggle para habilitar/desabilitar lembretes automáticos
- Histórico de notificações enviadas
- Logs de cron jobs
- Configurações de horário de envio

#### `/app/(dashboard)/waitlist/page.tsx`
Gestão de lista de espera:
- Tabela com pessoas aguardando
- Botão "Notificar" manual
- Filtros por serviço e data
- Status (ativo, notificado, convertido)

#### `/app/(dashboard)/packages/page.tsx`
CRUD de pacotes de serviços:
- Criar novo pacote
- Selecionar múltiplos serviços
- Calcular desconto automaticamente
- Preview visual do pacote

#### `/app/(dashboard)/loyalty/page.tsx`
Visão geral do programa de fidelidade:
- Total de cartões ativos
- Carimbos distribuídos
- Recompensas resgatadas
- Lista de clientes participantes

### Public Components

#### `/app/(public)/reschedule/[token]/page.tsx`
Página de reagendamento:
- Mostra dados do booking atual
- Calendário com horários disponíveis
- Botão cancelar
- Botão confirmar novo horário

#### `/app/(public)/waitlist/[slug]/page.tsx`
Modal/página para entrar na lista de espera:
- Form com dados do cliente
- Seletor de datas preferidas
- Time slots (manhã, tarde, noite)

#### `/app/(public)/loyalty/[token]/page.tsx`
Cartão de fidelidade digital:
- Visual de cartão com carimbos
- Progresso até próximo prêmio
- Histórico de serviços
- Botão "Resgatar Recompensa"

---

## ⚙️ CONFIGURAÇÃO VERCEL

### `vercel.json`
```json
{
  "crons": [
    {
      "path": "/api/cron/send-reminders",
      "schedule": "0 10 * * *"
    },
    {
      "path": "/api/cron/refresh-analytics",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/cleanup-tokens",
      "schedule": "0 2 * * *"
    }
  ]
}
```

### Environment Variables
```
CRON_SECRET=<secret_key_for_cron_auth>
```

---

## 🔐 SEGURANÇA

### Rate Limiting
```typescript
// /api/reschedule/[token]
- Max 10 tentativas por hora por IP
- Max 3 tentativas por token

// /api/waitlist
- Max 5 submissões por hora por IP
```

### Token Security
- UUIDs v4 (não-adivinháveis)
- Expiração automática (30 dias)
- Marcação como "usado" após uso
- Invalidação ao cancelar booking

---

## 📋 TASKS DO SPRINT 7

### Fase 1: Database & Cron Setup (Dia 1)
- [x] Task 34: Criar migration com todas as novas tabelas
- [x] Task 35: Configurar vercel.json com cron jobs
- [x] Task 36: Criar API /api/cron/send-reminders
- [x] Task 37: Criar API /api/cron/refresh-analytics
- [x] Task 38: Criar API /api/cron/cleanup-tokens

### Fase 2: Notificações (Dia 2)
- [x] Task 39: Implementar notification_queue e logs
- [x] Task 40: Criar sistema de templates multilíngue
- [x] Task 41: API de confirmação automática
- [x] Task 42: Dashboard de histórico de notificações

### Fase 3: Reagendamento (Dia 3)
- [x] Task 43: Gerar tokens ao criar booking
- [x] Task 44: Página pública /reschedule/[token]
- [x] Task 45: API de cancelamento
- [x] Task 46: API de reagendamento

### Fase 4: Waitlist (Dia 4)
- [x] Task 47: CRUD de waitlist
- [x] Task 48: Trigger de notificação automática
- [x] Task 49: Modal/página para entrar na lista
- [x] Task 50: Dashboard de gestão de waitlist

### Fase 5: Pacotes e Fidelidade (Dia 5)
- [x] Task 51: CRUD de service packages
- [x] Task 52: Agendamento de pacotes
- [x] Task 53: Sistema de loyalty cards
- [x] Task 54: Trigger automático de carimbos
- [x] Task 55: Página pública do cartão digital
- [x] Task 56: Deploy e testes finais

---

## 🧪 TESTES

### Cenários de Teste

1. **Lembretes Automáticos:**
   - Criar booking para amanhã → Esperar cron executar → Verificar log

2. **Confirmação Automática:**
   - Criar booking → Verificar se entrou na fila → Processar fila

3. **Reagendamento:**
   - Acessar link com token válido → Reagendar → Verificar novo horário
   - Acessar link com token expirado → Erro
   - Acessar link já usado → Erro

4. **Waitlist:**
   - Tentar agendar horário cheio → Entrar na lista → Cancelar booking → Verificar notificação

5. **Pacotes:**
   - Criar pacote de 3 serviços → Agendar pacote → Verificar bloqueio de múltiplos horários

6. **Fidelidade:**
   - Completar 10 bookings → Verificar stamp automático → Resgatar recompensa

---

## 📊 MÉTRICAS DE SUCESSO

- **Taxa de No-Show:** Reduzir de ~20% para <10% com lembretes automáticos
- **Tempo de Resposta:** Confirmação instantânea (< 1 minuto)
- **Ocupação:** Aumentar em 15% com waitlist
- **Ticket Médio:** Aumentar em 20% com pacotes
- **Retenção:** Aumentar em 30% com programa de fidelidade

---

## ⏱️ TIMELINE

| Dia | Fase | Entregas |
|-----|------|----------|
| 1 | Database & Cron | Migration, vercel.json, 3 cron endpoints |
| 2 | Notificações | Queue, templates, confirmação, dashboard |
| 3 | Reagendamento | Tokens, página pública, APIs |
| 4 | Waitlist | CRUD, trigger, modal, dashboard |
| 5 | Pacotes & Fidelidade | CRUD, agendamento, stamps, cartão digital |

---

**Status:** 🚀 PRONTO PARA IMPLEMENTAÇÃO

**Próximo passo:** Executar migration SQL no Supabase
