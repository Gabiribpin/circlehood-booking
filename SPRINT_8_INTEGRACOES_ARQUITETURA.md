# 🔗 SPRINT 8 - INTEGRAÇÕES - ARQUITETURA COMPLETA

**Data de Criação:** 17 de Fevereiro de 2026
**Duração Estimada:** 2 semanas
**Status:** 📋 PLANEJAMENTO
**Prioridade:** ALTA 🔥

---

## 🎯 OBJETIVO DO SPRINT

Conectar o CircleHood Booking com as principais plataformas externas para **automatizar completamente** o fluxo de trabalho do profissional e eliminar trabalho manual.

### Problemas a Resolver:

1. ❌ **Double Booking:** Profissional tem agenda no Google Calendar + CircleHood = conflitos
2. ❌ **WhatsApp Manual:** Envio de mensagens ainda requer ação manual (wa.me)
3. ❌ **Marketing Manual:** Profissional precisa postar no Instagram manualmente
4. ❌ **Sem Localização:** Clientes não conseguem ver mapa/endereço facilmente
5. ❌ **Email Marketing Zero:** Nenhuma ferramenta de email profissional
6. ❌ **Pagamentos BR:** Stripe difícil para brasileiros sem conta irlandesa

### Soluções:

1. ✅ **Google Calendar Sync** - Sincronização bidirecional automática
2. ✅ **WhatsApp Business API** - Envio 100% automático de mensagens
3. ✅ **Instagram Integration** - Posts automáticos de vagas/promoções
4. ✅ **Google Maps Embed** - Mapa interativo na página pública
5. ✅ **Email Marketing** - Integração com Resend/SendGrid para campanhas
6. ✅ **Revolut Business** - Gateway de pagamento alternativo

---

## 📊 TABELAS DO BANCO DE DADOS

### 1. Tabela: `integrations`

Armazena configurações de integrações ativas por profissional.

```sql
CREATE TABLE integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,

  -- Tipo de integração
  integration_type text NOT NULL, -- 'google_calendar', 'whatsapp_api', 'instagram', 'mailchimp', 'revolut'

  -- Status
  is_active boolean DEFAULT true,
  is_configured boolean DEFAULT false,

  -- Credenciais encriptadas (JSON)
  credentials jsonb NOT NULL DEFAULT '{}',

  -- Configurações específicas (JSON)
  settings jsonb DEFAULT '{}',

  -- Metadata
  last_sync_at timestamptz,
  sync_frequency text DEFAULT 'realtime', -- 'realtime', 'hourly', 'daily'

  -- Logs
  last_error text,
  error_count integer DEFAULT 0,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(professional_id, integration_type)
);

CREATE INDEX idx_integrations_professional ON integrations(professional_id);
CREATE INDEX idx_integrations_type ON integrations(integration_type);
CREATE INDEX idx_integrations_active ON integrations(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional gerencia suas integrações"
  ON integrations FOR ALL
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));
```

---

### 2. Tabela: `calendar_events`

Sincronização com Google Calendar (cache local).

```sql
CREATE TABLE calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,

  -- Referência ao booking (se aplicável)
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,

  -- Google Calendar ID
  google_event_id text UNIQUE,
  google_calendar_id text, -- ID do calendário específico

  -- Dados do evento
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  location text,

  -- Status
  status text DEFAULT 'confirmed', -- 'confirmed', 'tentative', 'cancelled'

  -- Fonte
  source text NOT NULL, -- 'circlehood', 'google', 'manual'

  -- Sincronização
  synced_to_google boolean DEFAULT false,
  last_synced_at timestamptz,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_calendar_events_professional ON calendar_events(professional_id);
CREATE INDEX idx_calendar_events_booking ON calendar_events(booking_id);
CREATE INDEX idx_calendar_events_google_id ON calendar_events(google_event_id);
CREATE INDEX idx_calendar_events_time ON calendar_events(start_time, end_time);

-- RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional vê seus eventos"
  ON calendar_events FOR SELECT
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));
```

---

### 3. Tabela: `whatsapp_messages`

Log de mensagens enviadas via WhatsApp Business API.

```sql
CREATE TABLE whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,

  -- Destinatário
  recipient_phone text NOT NULL,
  recipient_name text,

  -- Referência
  booking_id uuid REFERENCES bookings(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES whatsapp_campaigns(id) ON DELETE SET NULL,

  -- Conteúdo
  message_type text NOT NULL, -- 'text', 'template', 'media'
  message_content text NOT NULL,
  template_name text, -- Para templates aprovados

  -- WhatsApp API
  whatsapp_message_id text UNIQUE,

  -- Status
  status text DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'read', 'failed'
  error_message text,

  -- Timestamps
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_whatsapp_messages_professional ON whatsapp_messages(professional_id);
CREATE INDEX idx_whatsapp_messages_recipient ON whatsapp_messages(recipient_phone);
CREATE INDEX idx_whatsapp_messages_booking ON whatsapp_messages(booking_id);
CREATE INDEX idx_whatsapp_messages_status ON whatsapp_messages(status);
CREATE INDEX idx_whatsapp_messages_created ON whatsapp_messages(created_at DESC);

-- RLS
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional vê suas mensagens"
  ON whatsapp_messages FOR SELECT
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));
```

---

### 4. Tabela: `instagram_posts`

Histórico de posts automáticos no Instagram.

```sql
CREATE TABLE instagram_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,

  -- Conteúdo
  caption text NOT NULL,
  image_url text,
  post_type text DEFAULT 'feed', -- 'feed', 'story', 'reel'

  -- Instagram API
  instagram_post_id text UNIQUE,

  -- Status
  status text DEFAULT 'draft', -- 'draft', 'scheduled', 'published', 'failed'
  scheduled_for timestamptz,
  published_at timestamptz,

  -- Engajamento (atualizado via webhook)
  likes_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  shares_count integer DEFAULT 0,

  -- Erro
  error_message text,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_instagram_posts_professional ON instagram_posts(professional_id);
CREATE INDEX idx_instagram_posts_status ON instagram_posts(status);
CREATE INDEX idx_instagram_posts_published ON instagram_posts(published_at DESC);

-- RLS
ALTER TABLE instagram_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional gerencia seus posts"
  ON instagram_posts FOR ALL
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));
```

---

### 5. Tabela: `email_campaigns`

Campanhas de email marketing (integração Resend/SendGrid).

```sql
CREATE TABLE email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE,

  -- Dados da campanha
  name text NOT NULL,
  subject text NOT NULL,
  preview_text text,

  -- Conteúdo
  html_content text NOT NULL,

  -- Segmentação
  target_segment text, -- 'all', 'new_clients', 'inactive', 'vip'
  target_contacts uuid[], -- IDs específicos

  -- Provider
  email_provider text DEFAULT 'resend', -- 'resend', 'sendgrid'
  provider_campaign_id text,

  -- Status
  status text DEFAULT 'draft', -- 'draft', 'scheduled', 'sending', 'sent', 'failed'
  scheduled_for timestamptz,
  sent_at timestamptz,

  -- Estatísticas
  total_recipients integer DEFAULT 0,
  total_sent integer DEFAULT 0,
  total_delivered integer DEFAULT 0,
  total_opened integer DEFAULT 0,
  total_clicked integer DEFAULT 0,
  total_bounced integer DEFAULT 0,
  total_unsubscribed integer DEFAULT 0,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_email_campaigns_professional ON email_campaigns(professional_id);
CREATE INDEX idx_email_campaigns_status ON email_campaigns(status);

-- RLS
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional gerencia suas campanhas email"
  ON email_campaigns FOR ALL
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));
```

---

### 6. Atualizar Tabela: `professionals`

Adicionar campos para integrações.

```sql
-- Adicionar campos para Google Maps
ALTER TABLE professionals
ADD COLUMN IF NOT EXISTS latitude numeric(10, 7),
ADD COLUMN IF NOT EXISTS longitude numeric(10, 7),
ADD COLUMN IF NOT EXISTS google_place_id text;

-- Adicionar campos para redes sociais
ALTER TABLE professionals
ADD COLUMN IF NOT EXISTS instagram_handle text,
ADD COLUMN IF NOT EXISTS facebook_page_id text,
ADD COLUMN IF NOT EXISTS google_calendar_id text,
ADD COLUMN IF NOT EXISTS whatsapp_business_id text;

-- Adicionar preferências de pagamento
ALTER TABLE professionals
ADD COLUMN IF NOT EXISTS payment_methods jsonb DEFAULT '{"stripe": true, "revolut": false}';

CREATE INDEX idx_professionals_location ON professionals(latitude, longitude) WHERE latitude IS NOT NULL;
CREATE INDEX idx_professionals_instagram ON professionals(instagram_handle) WHERE instagram_handle IS NOT NULL;
```

---

## 🔌 API ENDPOINTS

### 1. Google Calendar Integration

#### `/api/integrations/google-calendar/connect` (POST)
Inicia OAuth flow do Google.

```typescript
// Redireciona para Google OAuth
// Callback: /api/integrations/google-calendar/callback
```

#### `/api/integrations/google-calendar/callback` (GET)
Callback do OAuth, salva tokens.

```typescript
// Troca code por access_token + refresh_token
// Salva em integrations table (encrypted)
```

#### `/api/integrations/google-calendar/sync` (POST)
Sincroniza bookings com Google Calendar.

```typescript
// 1. Buscar bookings não sincronizados
// 2. Criar eventos no Google Calendar
// 3. Buscar eventos do Google
// 4. Detectar conflitos
// 5. Retornar status
```

#### `/api/integrations/google-calendar/disconnect` (POST)
Desconecta integração.

---

### 2. WhatsApp Business API

#### `/api/integrations/whatsapp/connect` (POST)
Configura WhatsApp Business API.

```typescript
// Body: { phone_number_id, access_token, business_account_id }
// Valida credenciais
// Salva encrypted em integrations
```

#### `/api/integrations/whatsapp/send` (POST)
Envia mensagem via API oficial.

```typescript
// Body: { recipient, message, template_name? }
// Envia via WhatsApp Cloud API
// Salva em whatsapp_messages
// Retorna message_id
```

#### `/api/integrations/whatsapp/webhook` (POST)
Recebe webhooks do WhatsApp (status de mensagens).

```typescript
// Atualiza status: delivered, read, failed
// Atualiza whatsapp_messages table
```

#### `/api/integrations/whatsapp/templates` (GET)
Lista templates aprovados.

```typescript
// Busca templates do WhatsApp Business
// Retorna: nome, categoria, status, idiomas
```

---

### 3. Instagram Integration

#### `/api/integrations/instagram/connect` (POST)
Conecta conta do Instagram Business.

```typescript
// OAuth flow do Facebook/Instagram
// Salva access_token de longa duração
```

#### `/api/integrations/instagram/post` (POST)
Publica no Instagram.

```typescript
// Body: { caption, image_url, post_type }
// Upload via Instagram Graph API
// Salva em instagram_posts
```

#### `/api/integrations/instagram/schedule` (POST)
Agenda post para depois.

```typescript
// Body: { caption, image_url, scheduled_for }
// Salva como draft
// Cron job publica na hora agendada
```

---

### 4. Google Maps

#### `/api/integrations/google-maps/search` (GET)
Busca endereço e retorna coordenadas.

```typescript
// Query: ?address=...
// Google Geocoding API
// Retorna: lat, lng, place_id, formatted_address
```

#### `/api/integrations/google-maps/save` (POST)
Salva localização do profissional.

```typescript
// Body: { latitude, longitude, google_place_id }
// Atualiza professionals table
```

---

### 5. Email Marketing (Resend/SendGrid)

#### `/api/integrations/email/connect` (POST)
Configura provider de email.

```typescript
// Body: { provider: 'resend' | 'sendgrid', api_key }
// Valida API key
// Salva encrypted
```

#### `/api/integrations/email/campaign` (POST)
Cria campanha de email.

```typescript
// Body: { name, subject, html_content, target_segment }
// Cria em email_campaigns
// Retorna campaign_id
```

#### `/api/integrations/email/send` (POST)
Envia campanha.

```typescript
// Body: { campaign_id }
// Busca recipients
// Envia via Resend/SendGrid
// Atualiza estatísticas
```

---

### 6. Revolut Business

#### `/api/integrations/revolut/connect` (POST)
Conecta conta Revolut Business.

```typescript
// OAuth flow do Revolut
// Salva API keys
```

#### `/api/integrations/revolut/payment-link` (POST)
Gera link de pagamento.

```typescript
// Body: { amount, description, booking_id }
// Cria payment link via Revolut API
// Retorna URL para pagamento
```

---

## 🚀 IMPLEMENTAÇÃO FRONTEND

### 1. Página de Integrações

**Arquivo:** `src/app/(dashboard)/integrations/page.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Calendar,
  MessageCircle,
  Instagram,
  Mail,
  CreditCard,
  MapPin,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface Integration {
  type: string;
  name: string;
  description: string;
  icon: any;
  isActive: boolean;
  isConfigured: boolean;
  lastSync?: string;
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    const res = await fetch('/api/integrations');
    const data = await res.json();

    setIntegrations([
      {
        type: 'google_calendar',
        name: 'Google Calendar',
        description: 'Sincronize agendamentos automaticamente',
        icon: Calendar,
        isActive: data.google_calendar?.is_active || false,
        isConfigured: data.google_calendar?.is_configured || false,
        lastSync: data.google_calendar?.last_sync_at
      },
      {
        type: 'whatsapp_api',
        name: 'WhatsApp Business API',
        description: 'Envio automático de mensagens',
        icon: MessageCircle,
        isActive: data.whatsapp_api?.is_active || false,
        isConfigured: data.whatsapp_api?.is_configured || false
      },
      {
        type: 'instagram',
        name: 'Instagram',
        description: 'Posts automáticos de vagas',
        icon: Instagram,
        isActive: data.instagram?.is_active || false,
        isConfigured: data.instagram?.is_configured || false
      },
      {
        type: 'email',
        name: 'Email Marketing',
        description: 'Campanhas profissionais de email',
        icon: Mail,
        isActive: data.email?.is_active || false,
        isConfigured: data.email?.is_configured || false
      },
      {
        type: 'revolut',
        name: 'Revolut Business',
        description: 'Pagamentos alternativos',
        icon: CreditCard,
        isActive: data.revolut?.is_active || false,
        isConfigured: data.revolut?.is_configured || false
      },
      {
        type: 'google_maps',
        name: 'Google Maps',
        description: 'Localização na página pública',
        icon: MapPin,
        isActive: data.google_maps?.is_active || false,
        isConfigured: data.google_maps?.is_configured || false
      }
    ]);

    setLoading(false);
  };

  const handleConnect = async (type: string) => {
    if (type === 'google_calendar') {
      window.location.href = '/api/integrations/google-calendar/connect';
    } else if (type === 'whatsapp_api') {
      // Modal para inserir credenciais
    } else if (type === 'instagram') {
      window.location.href = '/api/integrations/instagram/connect';
    }
    // ... outros
  };

  const handleToggle = async (type: string, newState: boolean) => {
    await fetch(`/api/integrations/${type}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: newState })
    });
    loadIntegrations();
  };

  if (loading) {
    return <div className="p-6">Carregando integrações...</div>;
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Integrações</h1>
        <p className="text-gray-600 mt-1">
          Conecte suas ferramentas favoritas para automatizar seu negócio
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {integrations.map((integration) => (
          <Card key={integration.type} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <integration.icon className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">{integration.name}</h3>
                  <p className="text-sm text-gray-600">{integration.description}</p>
                </div>
              </div>

              {integration.isConfigured && (
                <Switch
                  checked={integration.isActive}
                  onCheckedChange={(checked) => handleToggle(integration.type, checked)}
                />
              )}
            </div>

            <div className="flex items-center gap-2 mb-4">
              {integration.isConfigured ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-green-600 font-medium">
                    Conectado
                  </span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                  <span className="text-sm text-orange-600 font-medium">
                    Não configurado
                  </span>
                </>
              )}
            </div>

            {integration.lastSync && (
              <p className="text-xs text-gray-500 mb-4">
                Última sincronização: {new Date(integration.lastSync).toLocaleString('pt-BR')}
              </p>
            )}

            {!integration.isConfigured ? (
              <Button
                onClick={() => handleConnect(integration.type)}
                className="w-full"
              >
                Conectar {integration.name}
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {/* Abrir configurações */}}
                >
                  Configurar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {/* Desconectar */}}
                >
                  Desconectar
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
```

---

## 📦 BIBLIOTECAS NECESSÁRIAS

```bash
# Google APIs
npm install googleapis @google-cloud/local-auth

# WhatsApp Business API
npm install whatsapp-cloud-api

# Instagram Graph API
npm install instagram-private-api

# Email Marketing
npm install @sendgrid/mail
# (Resend já instalado)

# Geolocation
npm install @googlemaps/google-maps-services-js

# Encryption (credenciais)
npm install crypto-js
```

---

## 🔐 VARIÁVEIS DE AMBIENTE

Adicionar em `.env.local`:

```bash
# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/integrations/google-calendar/callback

# WhatsApp Business API
WHATSAPP_BUSINESS_ACCOUNT_ID=...
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_WEBHOOK_VERIFY_TOKEN=...

# Instagram/Facebook
FACEBOOK_APP_ID=...
FACEBOOK_APP_SECRET=...
INSTAGRAM_ACCESS_TOKEN=...

# Google Maps
GOOGLE_MAPS_API_KEY=...

# Email Providers
SENDGRID_API_KEY=...
# RESEND_API_KEY já existe

# Revolut Business
REVOLUT_CLIENT_ID=...
REVOLUT_CLIENT_SECRET=...
REVOLUT_API_KEY=...

# Encryption Key
INTEGRATION_ENCRYPTION_KEY=... # Generate with: openssl rand -base64 32
```

---

## 📋 ORDEM DE IMPLEMENTAÇÃO

### Fase 1: Google Calendar (Prioridade ALTA) - 3 dias
1. ✅ Migration: integrations + calendar_events
2. ✅ OAuth flow Google Calendar
3. ✅ Sincronização bidirecional (booking ↔ calendar)
4. ✅ Detector de conflitos
5. ✅ UI de gerenciamento

### Fase 2: WhatsApp Business API (Prioridade ALTA) - 3 dias
1. ✅ Migration: whatsapp_messages
2. ✅ Setup WhatsApp Cloud API
3. ✅ Envio de mensagens
4. ✅ Webhook para status
5. ✅ Templates aprovados
6. ✅ Substituir wa.me por API real

### Fase 3: Google Maps (Prioridade MÉDIA) - 1 dia
1. ✅ Adicionar campos lat/lng em professionals
2. ✅ API de busca de endereço
3. ✅ Embed de mapa na página pública
4. ✅ Botão "Como chegar"

### Fase 4: Instagram + Email Marketing (Prioridade MÉDIA) - 2 dias
1. ✅ Migration: instagram_posts + email_campaigns
2. ✅ OAuth Instagram
3. ✅ Auto-post de vagas
4. ✅ Campanhas de email (Resend/SendGrid)

### Fase 5: Revolut Business (Prioridade BAIXA) - 1 dia
1. ✅ OAuth Revolut
2. ✅ Geração de payment links
3. ✅ Integrar no checkout

---

## 🧪 TESTES

### 1. Google Calendar
- [ ] Criar booking → Evento aparece no Google Calendar
- [ ] Criar evento no Google → Bloqueia horário no CircleHood
- [ ] Deletar booking → Remove evento do Google
- [ ] Detectar conflitos → Avisa profissional

### 2. WhatsApp Business API
- [ ] Enviar mensagem de confirmação → Mensagem enviada
- [ ] Webhook de status → Atualiza delivered/read
- [ ] Template aprovado → Envia corretamente
- [ ] Mensagem multilíngue → Idioma correto

### 3. Google Maps
- [ ] Buscar endereço → Retorna lat/lng
- [ ] Salvar localização → Atualiza professionals
- [ ] Mapa na página pública → Renderiza corretamente
- [ ] Botão "Como chegar" → Abre Google Maps

### 4. Instagram
- [ ] Conectar conta → OAuth bem-sucedido
- [ ] Publicar post → Aparece no feed
- [ ] Agendar post → Publica na hora correta

### 5. Email Marketing
- [ ] Criar campanha → Salva em email_campaigns
- [ ] Enviar email → Recipients recebem
- [ ] Estatísticas → Open rate atualiza

---

## ⚠️ CONSIDERAÇÕES IMPORTANTES

### 1. Custos das APIs
- **Google Calendar:** Grátis (até 1M requests/dia)
- **WhatsApp Business API:** ~€0.005-0.02/mensagem (depende do país)
- **Instagram API:** Grátis (limitado a 200 posts/dia)
- **Google Maps:** Grátis ($200 crédito/mês = ~28k requests)
- **Revolut:** Taxa de 1-2% por transação

### 2. Aprovações Necessárias
- **WhatsApp Business API:** Requer Business Verification (1-2 semanas)
- **Instagram API:** Requer Facebook Business aprovado
- **Revolut:** Conta Business ativa

### 3. Segurança
- **Encrypt credentials:** Usar `crypto-js` para encriptar tokens
- **Refresh tokens:** Implementar refresh automático de access tokens
- **Webhook validation:** Verificar assinatura de webhooks
- **Rate limiting:** Implementar rate limits nas APIs

---

## 🎯 CRITÉRIOS DE SUCESSO

Sprint 8 será considerado completo quando:

1. ✅ Google Calendar sincroniza 100% dos bookings
2. ✅ WhatsApp envia mensagens automaticamente (sem wa.me)
3. ✅ Mapa interativo funciona na página pública
4. ✅ Instagram posts automáticos funcionam
5. ✅ Email marketing configurado e testado
6. ✅ Revolut integrado como opção de pagamento

---

## 📊 MÉTRICAS ESPERADAS

Após Sprint 8:

| Métrica | Antes | Meta |
|---------|-------|------|
| Tempo de setup de booking | Manual (5min) | Automático (<10s) |
| Double bookings | ~5%/mês | 0% |
| Taxa de envio WhatsApp | Manual (50%) | Automático (100%) |
| Engajamento Instagram | 0 posts | 5-10 posts/semana |
| Conversão de email | 0% | >15% open rate |

---

## 🚀 PRÓXIMOS PASSOS

1. **Executar migrations** no Supabase
2. **Configurar OAuth apps** (Google, Facebook, WhatsApp)
3. **Implementar Google Calendar** (primeira integração)
4. **Testar sincronização** com bookings reais
5. **Deploy em produção** e monitorar

---

**Status:** 📋 Arquitetura completa - Pronto para implementação
**Estimativa:** 10 dias úteis (2 semanas)
**Desenvolvido por:** Claude Code
**Data:** 17/02/2026
