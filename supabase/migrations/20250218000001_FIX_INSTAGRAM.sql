-- =====================================================
-- FIX: Corrigir tabela instagram_posts
-- Execute ESTE arquivo para corrigir o problema
-- =====================================================

-- 1. Dropar a tabela instagram_posts se existir (CASCADE remove dependências)
DROP TABLE IF EXISTS instagram_posts CASCADE;

-- 2. Dropar o trigger se existir
DROP TRIGGER IF EXISTS instagram_auto_post_vacancy ON bookings CASCADE;

-- 3. Dropar a função se existir
DROP FUNCTION IF EXISTS auto_post_instagram_on_vacancy() CASCADE;

-- 4. Recriar a tabela corretamente
CREATE TABLE instagram_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid REFERENCES professionals(id) ON DELETE CASCADE NOT NULL,
  integration_id uuid REFERENCES integrations(id) ON DELETE SET NULL,

  -- Tipo de post
  post_type text NOT NULL CHECK (post_type IN ('feed', 'story', 'reel')),

  -- Conteúdo
  caption text,
  image_url text NOT NULL,

  -- Link para agendamento (stories com 10K+ followers)
  booking_link text,

  -- Resposta da API do Instagram
  instagram_media_id text UNIQUE,
  permalink text,

  -- Trigger que disparou o post
  trigger_type text CHECK (trigger_type IN ('manual', 'auto_vacancy', 'scheduled', 'gallery_sync')),
  trigger_data jsonb DEFAULT '{}',

  -- Estatísticas (via Instagram Graph API)
  likes_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  shares_count integer DEFAULT 0,
  saves_count integer DEFAULT 0,
  reach integer DEFAULT 0,
  impressions integer DEFAULT 0,

  -- Engajamento calculado
  engagement_rate numeric(5,2) GENERATED ALWAYS AS (
    CASE WHEN reach > 0
    THEN ROUND(((likes_count + comments_count + saves_count)::numeric / reach::numeric) * 100, 2)
    ELSE 0 END
  ) STORED,

  -- Status
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'posted', 'failed')),
  error_message text,

  -- Timestamps
  posted_at timestamp DEFAULT now(),
  created_at timestamp DEFAULT now()
);

-- 5. Criar índices
CREATE INDEX idx_instagram_posts_professional ON instagram_posts(professional_id);
CREATE INDEX idx_instagram_posts_type ON instagram_posts(post_type);
CREATE INDEX idx_instagram_posts_status ON instagram_posts(status);
CREATE INDEX idx_instagram_posts_trigger ON instagram_posts(trigger_type);

-- 6. RLS
ALTER TABLE instagram_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissional pode gerenciar seus posts no Instagram"
  ON instagram_posts FOR ALL
  USING (professional_id = auth.uid());

-- 7. Recriar a função do trigger
CREATE OR REPLACE FUNCTION auto_post_instagram_on_vacancy()
RETURNS TRIGGER AS $$
DECLARE
  v_integration_active boolean;
  v_service_name text;
  v_booking_time time;
BEGIN
  -- Verificar se integração Instagram está ativa
  SELECT is_active INTO v_integration_active
  FROM integrations
  WHERE professional_id = OLD.professional_id
    AND type = 'instagram'
    AND is_active = true
  LIMIT 1;

  IF NOT FOUND OR NOT v_integration_active THEN
    RETURN OLD;
  END IF;

  -- Buscar dados do serviço
  SELECT name INTO v_service_name
  FROM services
  WHERE id = OLD.service_id;

  v_booking_time := OLD.booking_date::time;

  -- Adicionar à fila de posts
  INSERT INTO instagram_posts (
    professional_id,
    integration_id,
    post_type,
    caption,
    image_url,
    trigger_type,
    trigger_data,
    status
  )
  SELECT
    OLD.professional_id,
    id,
    'story',
    format('🎉 Vaga Disponível! %s às %s. Link na bio para agendar!', v_service_name, v_booking_time),
    'https://circlehood-booking.vercel.app/api/og/vacancy-story?service=' || v_service_name || '&time=' || v_booking_time,
    'auto_vacancy',
    jsonb_build_object(
      'booking_id', OLD.id,
      'service_id', OLD.service_id,
      'date', OLD.booking_date
    ),
    'pending'
  FROM integrations
  WHERE professional_id = OLD.professional_id
    AND type = 'instagram'
    AND is_active = true
  LIMIT 1;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- 8. Recriar o trigger
CREATE TRIGGER instagram_auto_post_vacancy
  AFTER UPDATE OF status ON bookings
  FOR EACH ROW
  WHEN (OLD.status != 'cancelled' AND NEW.status = 'cancelled')
  EXECUTE FUNCTION auto_post_instagram_on_vacancy();

-- FIM
