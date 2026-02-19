-- Tabela de configuração do bot por usuário
CREATE TABLE bot_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identidade
  bot_name TEXT,
  bot_personality VARCHAR(20) DEFAULT 'friendly', -- friendly | professional | casual

  -- Comportamento
  auto_book_if_available BOOLEAN DEFAULT true,
  always_confirm_booking BOOLEAN DEFAULT false,
  ask_for_additional_info BOOLEAN DEFAULT false,

  -- Mensagens personalizadas
  greeting_message TEXT,
  unavailable_message TEXT,
  confirmation_message TEXT,

  -- Prompt avançado (se preenchido, substitui todo o prompt padrão)
  custom_system_prompt TEXT,

  -- Contexto de histórico
  max_context_messages INTEGER DEFAULT 10,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- RLS
ALTER TABLE bot_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own bot_config"
  ON bot_config FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
