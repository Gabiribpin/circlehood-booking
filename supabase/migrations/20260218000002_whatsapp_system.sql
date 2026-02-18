-- Tabela de configuração WhatsApp por usuário
CREATE TABLE whatsapp_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  verify_token TEXT NOT NULL,
  business_phone TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Tabela de conversas WhatsApp
CREATE TABLE whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  language VARCHAR(5) DEFAULT 'en',
  status VARCHAR(20) DEFAULT 'active', -- active, archived, blocked
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, customer_phone)
);

-- Tabela de mensagens
CREATE TABLE whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  whatsapp_message_id TEXT,
  direction VARCHAR(10) NOT NULL, -- inbound, outbound
  content TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'sent', -- sent, delivered, read, failed
  sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversation_messages ON whatsapp_messages (conversation_id, sent_at DESC);

-- Tabela de instruções de IA personalizadas
CREATE TABLE ai_instructions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  language VARCHAR(5) NOT NULL,
  instructions TEXT NOT NULL,
  welcome_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, language)
);

-- Tabela de templates de mensagem
CREATE TABLE whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  language VARCHAR(5) NOT NULL,
  category VARCHAR(50) NOT NULL, -- reminder, birthday, follow_up, etc
  template TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name, language)
);

-- RLS Policies
ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_instructions ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- Policies para whatsapp_config
CREATE POLICY "Users can view own WhatsApp config"
  ON whatsapp_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own WhatsApp config"
  ON whatsapp_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own WhatsApp config"
  ON whatsapp_config FOR UPDATE
  USING (auth.uid() = user_id);

-- Policies para whatsapp_conversations
CREATE POLICY "Users can view own conversations"
  ON whatsapp_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own conversations"
  ON whatsapp_conversations FOR ALL
  USING (auth.uid() = user_id);

-- Policies para whatsapp_messages
CREATE POLICY "Users can view messages from own conversations"
  ON whatsapp_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM whatsapp_conversations
      WHERE whatsapp_conversations.id = whatsapp_messages.conversation_id
      AND whatsapp_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages to own conversations"
  ON whatsapp_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM whatsapp_conversations
      WHERE whatsapp_conversations.id = whatsapp_messages.conversation_id
      AND whatsapp_conversations.user_id = auth.uid()
    )
  );

-- Policies para ai_instructions
CREATE POLICY "Users can manage own AI instructions"
  ON ai_instructions FOR ALL
  USING (auth.uid() = user_id);

-- Policies para whatsapp_templates
CREATE POLICY "Users can manage own templates"
  ON whatsapp_templates FOR ALL
  USING (auth.uid() = user_id);
