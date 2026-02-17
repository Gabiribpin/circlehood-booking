# 🚀 SPRINT 8 - FASE 2: SETUP DAS INTEGRAÇÕES

**Data:** 17 de Fevereiro de 2026
**Integrações:** Google Maps, Email Marketing, Instagram, Revolut
**Status:** Código completo ✅ | Setup de APIs necessário ⏳

---

## 📋 CHECKLIST GERAL

- [ ] **1. Google Maps** - Obter API Key (5 min)
- [ ] **2. Email Marketing** - Já configurado via Resend ✅
- [ ] **3. Instagram** - Criar Meta App (15 min)
- [ ] **4. Revolut** - Criar conta Merchant (20 min)
- [ ] **5. Executar Migration** - Banco de dados (2 min)
- [ ] **6. Deploy** - Vercel (5 min)
- [ ] **7. Testes** - Validar integrações (15 min)

**Tempo Total Estimado:** ~1 hora

---

## 🗺️ 1. GOOGLE MAPS API

### Passo 1: Obter API Key

1. **Acesse Google Cloud Console:**
   ```
   https://console.cloud.google.com/apis/credentials?project=circlehoodbooking-487718
   ```

2. **Ativar Google Maps JavaScript API:**
   - Menu → APIs & Services → Library
   - Buscar "Maps JavaScript API"
   - Clicar em "ENABLE"

3. **Criar API Key:**
   - Menu → APIs & Services → Credentials
   - Clicar em "+ CREATE CREDENTIALS" → API key
   - Copiar a chave gerada
   - Clicar em "RESTRICT KEY"

4. **Configurar Restrições:**
   - **Application restrictions:** HTTP referrers
   - Adicionar referrers:
     ```
     localhost:3000/*
     circlehood-booking.vercel.app/*
     *.vercel.app/*
     ```
   - **API restrictions:** Restrict key
   - Selecionar apenas:
     - Maps JavaScript API
     - Places API (opcional, para autocomplete)

5. **Salvar a API Key:**
   ```bash
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...
   ```

### Passo 2: Adicionar Script no Layout

O script já está configurado em `src/app/(dashboard)/layout.tsx`:

```tsx
<Script
  src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
  strategy="lazyOnload"
/>
```

### Passo 3: Atualizar Variáveis no Vercel

```bash
# Production
vercel env add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY production

# Preview
vercel env add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY preview

# Development
vercel env add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY development
```

Cole a API Key quando solicitado.

### Custo:
- **Grátis:** Até 28.000 map loads/mês
- **Depois:** $7 por 1.000 loads extras

---

## 📧 2. EMAIL MARKETING

### ✅ JÁ CONFIGURADO!

A integração de Email Marketing usa o **Resend** que já está configurado:

```bash
RESEND_API_KEY=re_iebgvquj_LpTf9Nov5LGSnpA9Rhp8DaSB
```

### Configurar Webhooks do Resend (Opcional)

1. **Acesse Resend Dashboard:**
   ```
   https://resend.com/webhooks
   ```

2. **Criar Webhook:**
   - URL: `https://circlehood-booking.vercel.app/api/webhooks/resend`
   - Events:
     - [x] email.delivered
     - [x] email.opened
     - [x] email.clicked
     - [x] email.bounced
     - [x] email.complained

3. **Copiar Signing Secret:**
   ```bash
   RESEND_WEBHOOK_SECRET=whsec_...
   ```

### Features Disponíveis:
- ✅ Templates pré-prontos (Promoção, Follow-up, Newsletter)
- ✅ Segmentação de clientes (new, occasional, recurring, inactive)
- ✅ Personalização automática (nome, serviço, link)
- ✅ Tracking de abertura e cliques
- ✅ Envio em lote (100 emails/batch)

---

## 📸 3. INSTAGRAM INTEGRATION

### Passo 1: Criar Meta App

1. **Acesse Meta for Developers:**
   ```
   https://developers.facebook.com/apps
   ```

2. **Criar Nova App:**
   - Clicar em "Create App"
   - Tipo: **Business**
   - Nome: `CircleHood Booking`
   - Email: `circlehoodtech@gmail.com`
   - Categoria: Business Tools

3. **Adicionar Instagram Graph API:**
   - No dashboard da app, clicar em "Add Product"
   - Selecionar **Instagram Graph API**
   - Clicar em "Set Up"

### Passo 2: Configurar OAuth

1. **No painel da App:**
   - Settings → Basic
   - Copiar **App ID** e **App Secret**

2. **Adicionar OAuth Redirect URIs:**
   - Settings → Basic → Add Platform → Website
   - Site URL: `https://circlehood-booking.vercel.app`
   - Em "Instagram Graph API Settings":
     - Valid OAuth Redirect URIs:
       ```
       http://localhost:3000/api/integrations/instagram/callback
       https://circlehood-booking.vercel.app/api/integrations/instagram/callback
       ```

### Passo 3: Configurar Permissões

1. **App Review → Permissions and Features:**
   - `instagram_basic` (aprovado automaticamente)
   - `instagram_content_publish` (requer aprovação)

2. **Solicitar Aprovação:**
   - Business Verification primeiro
   - Depois solicitar `instagram_content_publish`
   - Tempo de aprovação: 1-2 dias úteis

### Passo 4: Salvar Credenciais

```bash
INSTAGRAM_CLIENT_ID=seu_app_id
INSTAGRAM_CLIENT_SECRET=seu_app_secret
```

### Passo 5: Conectar Instagram Business Account

**Importante:** Sua conta Instagram deve ser **Business** ou **Creator**.

Para converter:
1. Abrir Instagram App
2. Ir em Configurações → Account
3. Selecionar "Switch to Professional Account"
4. Escolher **Business**
5. Conectar à Página do Facebook

### Limitações:
- **Stories com Link:** Requer 10K+ seguidores
- **Alternativa:** Texto "Link na bio para agendar"
- **API Quota:** 200 calls/hora (suficiente)

---

## 💳 4. REVOLUT BUSINESS

### Passo 1: Criar Conta Revolut Business

1. **Signup:**
   ```
   https://business.revolut.com/signup
   ```

2. **Verificação de Identidade:**
   - Upload de documento (Passaporte/ID)
   - Selfie
   - Comprovante de endereço
   - **Tempo:** ~24-48h para aprovação

### Passo 2: Ativar Merchant API

1. **Acesse Dashboard:**
   ```
   https://business.revolut.com/settings/api
   ```

2. **Gerar API Key:**
   - Merchant API → Generate API Key
   - **Ambiente:** Sandbox (para testes)
   - **Permissões:** Merchant Payments
   - Copiar a chave

3. **Salvar Credenciais:**
   ```bash
   REVOLUT_API_KEY=sk_sandbox_...
   ```

### Passo 3: Configurar Webhook

1. **No Dashboard:**
   - Settings → Webhooks → Add Webhook

2. **URL:**
   ```
   https://circlehood-booking.vercel.app/api/webhooks/revolut
   ```

3. **Events:**
   - [x] ORDER_COMPLETED
   - [x] ORDER_AUTHORISED
   - [x] ORDER_CANCELLED
   - [x] ORDER_PAYMENT_FAILED

4. **Copiar Signing Secret:**
   ```bash
   REVOLUT_WEBHOOK_SECRET=whsec_...
   ```

### Passo 4: Modo Produção

Quando estiver pronto para produção:
1. Trocar para API Key de produção
2. Atualizar webhook URL
3. Re-verificar compliance Revolut

### Taxas:
- **Transação:** 1.2% + €0.20
- **Comparação com Stripe:** 1.4% + €0.25
- **Economia:** ~€0.07 por transação de €9.99

---

## 🗄️ 5. EXECUTAR MIGRATION NO SUPABASE

### Passo 1: Abrir SQL Editor

```
https://supabase.com/dashboard/project/ibkkxykcrwhncvqxzynt/sql/new
```

### Passo 2: Copiar Migration

Abrir arquivo:
```
/Users/gabrielapinheiro/Desktop/circlehood-booking/supabase/migrations/20250218000001_sprint8_fase2_integrations.sql
```

### Passo 3: Executar

1. Colar SQL completo no editor
2. Clicar em **RUN** (Cmd+Enter)
3. Aguardar ~10 segundos
4. Ver mensagem "Success" ✅

### O que a Migration Cria:

**Tabelas:**
- `email_campaigns` - Campanhas de email
- `email_campaign_recipients` - Destinatários individuais
- `instagram_posts` - Posts no Instagram
- `revolut_payments` - Pagamentos Revolut

**Campos Novos em `professionals`:**
- `address`, `city`, `postal_code`, `country`
- `latitude`, `longitude`, `google_place_id`
- `instagram_handle`, `instagram_user_id`, `instagram_bio`
- `payment_provider`, `revolut_merchant_id`

**Views:**
- `email_campaign_performance` - Analytics de campanhas
- `instagram_performance` - Analytics de posts

**Funções:**
- `get_contacts_by_segment()` - Buscar contatos por segmento

**Triggers:**
- `instagram_auto_post_vacancy()` - Auto-post ao cancelar booking

---

## 🚀 6. DEPLOY NA VERCEL

### Passo 1: Adicionar Variáveis de Ambiente

```bash
# Google Maps
vercel env add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY production
vercel env add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY preview

# Instagram
vercel env add INSTAGRAM_CLIENT_ID production
vercel env add INSTAGRAM_CLIENT_SECRET production
vercel env add INSTAGRAM_CLIENT_ID preview
vercel env add INSTAGRAM_CLIENT_SECRET preview

# Revolut
vercel env add REVOLUT_API_KEY production
vercel env add REVOLUT_WEBHOOK_SECRET production
vercel env add REVOLUT_API_KEY preview
vercel env add REVOLUT_WEBHOOK_SECRET preview
```

### Passo 2: Commit & Push

```bash
git add .
git commit -m "feat: Sprint 8 Fase 2 - Email, Instagram, Revolut, Google Maps"
git push
```

### Passo 3: Aguardar Deploy

Deploy automático em ~2-3 minutos.

---

## 🧪 7. TESTAR INTEGRAÇÕES

### Teste 1: Google Maps

1. Acesse `/settings` (em breve)
2. Adicione endereço completo
3. Veja mapa na página pública `/{seu-slug}`

### Teste 2: Email Marketing

1. Acesse `/email-campaigns`
2. Crie nova campanha
3. Selecione template "Promoção"
4. Escolha segmento "all"
5. Envie email de teste

### Teste 3: Instagram

1. Acesse `/integrations`
2. Clicar em "Conectar Instagram"
3. Fazer login com sua conta Business
4. Autorizar permissões
5. Voltar para /integrations → Ver "Conectado" ✅
6. Teste manual: postar story de vaga

### Teste 4: Revolut

1. Acesse `/settings?tab=payment`
2. Selecionar "Revolut" como provider
3. Criar ordem de teste
4. Usar cartão de teste Revolut
5. Verificar webhook recebido

---

## 🔒 SEGURANÇA

### Variáveis Sensíveis (NUNCA commitar):
- ❌ `GOOGLE_MAPS_API_KEY`
- ❌ `INSTAGRAM_CLIENT_SECRET`
- ❌ `REVOLUT_API_KEY`
- ❌ `REVOLUT_WEBHOOK_SECRET`

### Validar .gitignore:
```bash
.env.local
.env*.local
```

---

## 📊 MONITORAMENTO

### Google Maps:
```
https://console.cloud.google.com/google/maps-apis/metrics
```

### Resend:
```
https://resend.com/emails
```

### Instagram:
```
https://developers.facebook.com/apps/YOUR_APP_ID/dashboard
```

### Revolut:
```
https://business.revolut.com/merchant
```

---

## 🐛 TROUBLESHOOTING

### Google Maps não carrega:
1. Verificar API Key no console
2. Verificar se Maps JavaScript API está ativa
3. Verificar referrers permitidos
4. Abrir DevTools → Console para erros

### Instagram OAuth falha:
1. Verificar se conta é Business/Creator
2. Verificar redirect URIs
3. Ver logs em Meta App Dashboard → Webhooks

### Revolut webhook não dispara:
1. Verificar URL do webhook
2. Testar com Revolut Sandbox
3. Ver logs no Vercel → Functions

### Email não envia:
1. Verificar RESEND_API_KEY
2. Ver logs em Resend Dashboard
3. Verificar se domínio está verificado

---

## ✅ PRÓXIMOS PASSOS

Após setup completo:

1. **Documentar no task manager** ✅
2. **Atualizar ROADMAP** com status
3. **Criar guia de uso** para profissionais
4. **Treinar primeiro beta tester**
5. **Coletar feedback**
6. **Iterar melhorias**

---

**Status:** Pronto para setup! 🚀
**Perguntas:** circlehoodtech@gmail.com
