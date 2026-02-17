cisa# 🚀 SPRINT 8 - GUIA DE INÍCIO RÁPIDO

**Status Atual:** Sprint 7 ✅ 100% Completo
**Próximo:** Sprint 8 - Integrações 🔗
**Duração:** 2 semanas (10 dias úteis)

---

## 📅 CRONOGRAMA SUGERIDO

### Semana 1: Google Calendar + WhatsApp API

**Segunda (18/02):**
- [ ] Executar migrations do Sprint 8 no Supabase
- [ ] Criar projeto no Google Cloud Console
- [ ] Configurar OAuth 2.0 para Google Calendar
- [ ] Implementar `/api/integrations/google-calendar/connect`

**Terça (19/02):**
- [ ] Implementar callback OAuth
- [ ] Criar função de sincronização bidirecional
- [ ] Testar: booking → Google Calendar event
- [ ] Testar: Google event → bloqueia horário CircleHood

**Quarta (20/02):**
- [ ] Registrar WhatsApp Business (Meta Business Suite)
- [ ] Obter Phone Number ID + Access Token
- [ ] Configurar Webhook no Vercel
- [ ] Implementar `/api/integrations/whatsapp/send`

**Quinta (21/02):**
- [ ] Criar templates de mensagem no WhatsApp Manager
- [ ] Implementar envio de confirmação automática
- [ ] Implementar webhook de status (delivered/read)
- [ ] Substituir wa.me por WhatsApp API nos bookings

**Sexta (22/02):**
- [ ] Implementar Google Maps embed
- [ ] Adicionar lat/lng na tabela professionals
- [ ] API de busca de endereço (Geocoding)
- [ ] Botão "Como chegar" na página pública

---

### Semana 2: Instagram + Email + Revolut

**Segunda (25/02):**
- [ ] Conectar Instagram Business (OAuth Facebook)
- [ ] Implementar `/api/integrations/instagram/post`
- [ ] Testar publicação automática
- [ ] Schedule posts para horários estratégicos

**Terça (26/02):**
- [ ] Configurar SendGrid ou usar Resend existente
- [ ] Criar templates de email profissionais
- [ ] Implementar `/api/integrations/email/campaign`
- [ ] Testar envio de campanha

**Quarta (27/02):**
- [ ] Criar conta Revolut Business (se necessário)
- [ ] Implementar OAuth Revolut
- [ ] Gerar payment links
- [ ] Integrar no checkout existente

**Quinta (28/02):**
- [ ] Criar página `/integrations` no dashboard
- [ ] UI para conectar/desconectar cada integração
- [ ] Toggle para ativar/desativar
- [ ] Logs de sincronização

**Sexta (01/03):**
- [ ] Testes finais de integração
- [ ] Deploy em produção
- [ ] Monitorar logs e erros
- [ ] Documentação completa Sprint 8

---

## 🔑 PRÉ-REQUISITOS

### 1. Contas Necessárias

#### Google Cloud Platform
1. Acessar: https://console.cloud.google.com
2. Criar novo projeto: "CircleHood Booking"
3. Habilitar APIs:
   - Google Calendar API
   - Google Maps JavaScript API
   - Geocoding API
4. Criar credenciais OAuth 2.0:
   - Authorized redirect URI: `https://circlehood-booking.vercel.app/api/integrations/google-calendar/callback`
5. Copiar Client ID e Client Secret

#### Meta Business Suite (WhatsApp + Instagram)
1. Acessar: https://business.facebook.com
2. Criar Business Account
3. WhatsApp:
   - Ir em WhatsApp → API Setup
   - Adicionar número de telefone
   - Verificar número
   - Copiar: Phone Number ID, WhatsApp Business Account ID, Access Token
4. Instagram:
   - Conectar página do Instagram Business
   - Adicionar app ao Business Manager
   - Gerar Access Token de longa duração

#### Revolut Business (Opcional)
1. Criar conta: https://business.revolut.com
2. Completar verificação KYB
3. Habilitar Merchant API
4. Gerar API keys

---

## 📋 MIGRATION SQL

Execute no Supabase SQL Editor:

```sql
-- Arquivo: supabase/migrations/20250218000000_sprint8_integrations.sql

-- ========================================
-- SPRINT 8: INTEGRAÇÕES
-- ========================================

-- 1. Tabela de configurações de integrações
CREATE TABLE integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,
  integration_type text NOT NULL,
  is_active boolean DEFAULT true,
  is_configured boolean DEFAULT false,
  credentials jsonb NOT NULL DEFAULT '{}',
  settings jsonb DEFAULT '{}',
  last_sync_at timestamptz,
  sync_frequency text DEFAULT 'realtime',
  last_error text,
  error_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(professional_id, integration_type)
);

CREATE INDEX idx_integrations_professional ON integrations(professional_id);
CREATE INDEX idx_integrations_type ON integrations(integration_type);

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional gerencia suas integrações"
  ON integrations FOR ALL
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));

-- 2. Eventos do Google Calendar (cache local)
CREATE TABLE calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  google_event_id text UNIQUE,
  google_calendar_id text,
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  location text,
  status text DEFAULT 'confirmed',
  source text NOT NULL,
  synced_to_google boolean DEFAULT false,
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_calendar_events_professional ON calendar_events(professional_id);
CREATE INDEX idx_calendar_events_booking ON calendar_events(booking_id);
CREATE INDEX idx_calendar_events_time ON calendar_events(start_time, end_time);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional vê seus eventos"
  ON calendar_events FOR SELECT
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));

-- 3. Mensagens WhatsApp (log)
CREATE TABLE whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,
  recipient_phone text NOT NULL,
  recipient_name text,
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  message_type text NOT NULL,
  message_content text NOT NULL,
  template_name text,
  whatsapp_message_id text UNIQUE,
  status text DEFAULT 'pending',
  error_message text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_whatsapp_messages_professional ON whatsapp_messages(professional_id);
CREATE INDEX idx_whatsapp_messages_status ON whatsapp_messages(status);

ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional vê suas mensagens"
  ON whatsapp_messages FOR SELECT
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));

-- 4. Posts Instagram
CREATE TABLE instagram_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,
  caption text NOT NULL,
  image_url text,
  post_type text DEFAULT 'feed',
  instagram_post_id text UNIQUE,
  status text DEFAULT 'draft',
  scheduled_for timestamptz,
  published_at timestamptz,
  likes_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_instagram_posts_professional ON instagram_posts(professional_id);
CREATE INDEX idx_instagram_posts_status ON instagram_posts(status);

ALTER TABLE instagram_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional gerencia seus posts"
  ON instagram_posts FOR ALL
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));

-- 5. Campanhas de Email
CREATE TABLE email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL,
  html_content text NOT NULL,
  target_segment text,
  status text DEFAULT 'draft',
  scheduled_for timestamptz,
  sent_at timestamptz,
  total_recipients integer DEFAULT 0,
  total_sent integer DEFAULT 0,
  total_opened integer DEFAULT 0,
  total_clicked integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_email_campaigns_professional ON email_campaigns(professional_id);

ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional gerencia campanhas email"
  ON email_campaigns FOR ALL
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));

-- 6. Atualizar tabela professionals (Google Maps + socials)
ALTER TABLE professionals
ADD COLUMN IF NOT EXISTS latitude numeric(10, 7),
ADD COLUMN IF NOT EXISTS longitude numeric(10, 7),
ADD COLUMN IF NOT EXISTS google_place_id text,
ADD COLUMN IF NOT EXISTS instagram_handle text,
ADD COLUMN IF NOT EXISTS facebook_page_id text,
ADD COLUMN IF NOT EXISTS google_calendar_id text,
ADD COLUMN IF NOT EXISTS whatsapp_business_id text,
ADD COLUMN IF NOT EXISTS payment_methods jsonb DEFAULT '{"stripe": true, "revolut": false}';

CREATE INDEX idx_professionals_location ON professionals(latitude, longitude)
  WHERE latitude IS NOT NULL;
```

---

## 🔧 CONFIGURAÇÃO INICIAL

### 1. Instalar Dependências

```bash
cd /Users/gabrielapinheiro/Desktop/circlehood-booking

npm install googleapis @google-cloud/local-auth whatsapp-cloud-api @sendgrid/mail @googlemaps/google-maps-services-js crypto-js
```

### 2. Adicionar Variáveis de Ambiente

Editar `.env.local`:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=seu-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/integrations/google-calendar/callback

# WhatsApp Business API
WHATSAPP_BUSINESS_ACCOUNT_ID=seu-business-account-id
WHATSAPP_PHONE_NUMBER_ID=seu-phone-number-id
WHATSAPP_ACCESS_TOKEN=seu-access-token
WHATSAPP_WEBHOOK_VERIFY_TOKEN=seu-verify-token-secreto

# Instagram/Facebook
FACEBOOK_APP_ID=seu-app-id
FACEBOOK_APP_SECRET=seu-app-secret

# Google Maps
GOOGLE_MAPS_API_KEY=sua-api-key

# SendGrid (opcional)
SENDGRID_API_KEY=sua-sendgrid-key

# Revolut Business (opcional)
REVOLUT_CLIENT_ID=seu-client-id
REVOLUT_CLIENT_SECRET=seu-client-secret

# Encryption Key (gerar novo)
INTEGRATION_ENCRYPTION_KEY=gerar-com-openssl-rand-base64-32
```

### 3. Gerar Encryption Key

```bash
openssl rand -base64 32
```

Copiar resultado para `INTEGRATION_ENCRYPTION_KEY`.

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Google Calendar (Dias 1-2)

- [ ] Migration executada no Supabase
- [ ] Google Cloud project criado
- [ ] OAuth 2.0 configurado
- [ ] API `/api/integrations/google-calendar/connect` criada
- [ ] API `/api/integrations/google-calendar/callback` criada
- [ ] API `/api/integrations/google-calendar/sync` criada
- [ ] Função de sincronização bidirecional implementada
- [ ] Detector de conflitos implementado
- [ ] Teste: booking cria evento no Google ✅
- [ ] Teste: evento Google bloqueia horário ✅

### Fase 2: WhatsApp Business API (Dias 3-4)

- [ ] WhatsApp Business registrado
- [ ] Phone Number ID obtido
- [ ] Access Token configurado
- [ ] Webhook configurado no Vercel
- [ ] API `/api/integrations/whatsapp/send` criada
- [ ] API `/api/integrations/whatsapp/webhook` criada
- [ ] Templates aprovados no Meta Business
- [ ] Confirmação automática enviando via API ✅
- [ ] Lembrete automático enviando via API ✅
- [ ] Status delivery/read atualizando ✅

### Fase 3: Google Maps (Dia 5)

- [ ] Campos lat/lng adicionados em professionals
- [ ] API `/api/integrations/google-maps/search` criada
- [ ] API `/api/integrations/google-maps/save` criada
- [ ] Componente de mapa embed criado
- [ ] Botão "Como chegar" implementado
- [ ] Teste: mapa renderiza na página pública ✅

### Fase 4: Instagram + Email (Dias 6-7)

- [ ] Instagram Business conectado
- [ ] API `/api/integrations/instagram/post` criada
- [ ] API `/api/integrations/instagram/schedule` criada
- [ ] SendGrid ou Resend configurado
- [ ] API `/api/integrations/email/campaign` criada
- [ ] API `/api/integrations/email/send` criada
- [ ] Templates de email criados
- [ ] Teste: post Instagram publicado ✅
- [ ] Teste: email campaign enviado ✅

### Fase 5: Revolut + Dashboard (Dias 8-10)

- [ ] Revolut Business account criada
- [ ] OAuth Revolut configurado
- [ ] API `/api/integrations/revolut/payment-link` criada
- [ ] Página `/integrations` criada
- [ ] UI de conexão/desconexão implementada
- [ ] Toggles de ativar/desativar implementados
- [ ] Logs de sincronização exibidos
- [ ] Deploy em produção ✅
- [ ] Documentação completa ✅

---

## 🎯 PRÓXIMO PASSO IMEDIATO

**AGORA (17/02 - Hoje):**
1. ✅ Ler arquitetura completa do Sprint 8
2. ✅ Revisar dependências e custos
3. [ ] Criar contas necessárias (Google Cloud, Meta Business)
4. [ ] Executar migration no Supabase
5. [ ] Começar Fase 1: Google Calendar

**Comando para começar:**
```bash
# 1. Executar migration
# Copiar conteúdo de SPRINT_8_INICIO_RAPIDO.md (seção Migration SQL)
# Colar em: https://supabase.com/dashboard/project/ibkkxykcrwhncvqxzynt/sql/new
# Click RUN

# 2. Instalar deps
npm install googleapis @google-cloud/local-auth whatsapp-cloud-api @sendgrid/mail @googlemaps/google-maps-services-js crypto-js

# 3. Criar primeiro endpoint
mkdir -p src/app/api/integrations/google-calendar
touch src/app/api/integrations/google-calendar/connect/route.ts
```

---

## 📞 SUPORTE

**Dúvidas sobre APIs:**
- Google Calendar: https://developers.google.com/calendar/api
- WhatsApp Business: https://developers.facebook.com/docs/whatsapp
- Instagram Graph API: https://developers.facebook.com/docs/instagram-api
- Google Maps: https://developers.google.com/maps/documentation

**Status do Projeto:**
- Sprint 1-7: ✅ 100% Completo
- Sprint 8: 📋 Em Planejamento
- Sprint 9: ⏳ Aguardando

---

**Desenvolvido por:** Claude Code
**Data:** 17/02/2026
**Tempo estimado:** 10 dias úteis (2 semanas)
