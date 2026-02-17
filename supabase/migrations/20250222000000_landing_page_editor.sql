-- ============================================
-- SPRINT 6: Landing Page Editor
-- Migration completa para sistema de editor visual
-- ============================================

-- ============================================
-- 1. FUNÇÃO: Update updated_at (se não existir)
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 2. TABELA: page_sections
-- ============================================

CREATE TABLE IF NOT EXISTS page_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE NOT NULL,

  -- Tipo da seção
  section_type TEXT NOT NULL CHECK (
    section_type IN ('hero', 'about', 'services', 'gallery', 'testimonials', 'faq', 'contact')
  ),

  -- Ordem de exibição (menor = aparece primeiro)
  order_index INTEGER NOT NULL,

  -- Dados específicos da seção (JSON flexível)
  data JSONB NOT NULL DEFAULT '{}',

  -- Visibilidade
  is_visible BOOLEAN DEFAULT true,

  -- Theme/Settings
  theme TEXT DEFAULT 'default' CHECK (
    theme IN ('default', 'modern', 'elegant', 'minimalist')
  ),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint única: professional + tipo (cada tipo aparece uma vez)
  UNIQUE(professional_id, section_type)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_page_sections_professional ON page_sections(professional_id);
CREATE INDEX IF NOT EXISTS idx_page_sections_order ON page_sections(professional_id, order_index);
CREATE INDEX IF NOT EXISTS idx_page_sections_visible ON page_sections(is_visible) WHERE is_visible = true;

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_page_sections_updated_at ON page_sections;
CREATE TRIGGER update_page_sections_updated_at
  BEFORE UPDATE ON page_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE page_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profissionais gerenciam suas seções" ON page_sections;
CREATE POLICY "Profissionais gerenciam suas seções"
  ON page_sections FOR ALL
  USING (
    professional_id IN (
      SELECT id FROM professionals WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Seções públicas são visíveis para todos" ON page_sections;
CREATE POLICY "Seções públicas são visíveis para todos"
  ON page_sections FOR SELECT
  USING (is_visible = true);

-- ============================================
-- 3. TABELA: gallery_images
-- ============================================

CREATE TABLE IF NOT EXISTS gallery_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE NOT NULL,

  -- URL da imagem no Supabase Storage
  image_url TEXT NOT NULL,

  -- Metadata
  title TEXT,
  description TEXT,
  category TEXT,  -- 'hair', 'nails', 'makeup', 'skincare', 'other'

  -- Before/After
  is_before_after BOOLEAN DEFAULT false,
  before_image_url TEXT,
  after_image_url TEXT,

  -- Ordem de exibição
  order_index INTEGER DEFAULT 0,

  -- Visibilidade
  is_visible BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_gallery_images_professional ON gallery_images(professional_id);
CREATE INDEX IF NOT EXISTS idx_gallery_images_category ON gallery_images(category);
CREATE INDEX IF NOT EXISTS idx_gallery_images_order ON gallery_images(professional_id, order_index);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_gallery_images_updated_at ON gallery_images;
CREATE TRIGGER update_gallery_images_updated_at
  BEFORE UPDATE ON gallery_images
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profissionais gerenciam suas imagens" ON gallery_images;
CREATE POLICY "Profissionais gerenciam suas imagens"
  ON gallery_images FOR ALL
  USING (
    professional_id IN (
      SELECT id FROM professionals WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Imagens visíveis são públicas" ON gallery_images;
CREATE POLICY "Imagens visíveis são públicas"
  ON gallery_images FOR SELECT
  USING (is_visible = true);

-- ============================================
-- 4. TABELA: testimonials
-- ============================================

CREATE TABLE IF NOT EXISTS testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE NOT NULL,

  -- Dados do cliente
  client_name TEXT NOT NULL,
  client_photo_url TEXT,

  -- Depoimento
  testimonial_text TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,

  -- Metadata
  service_name TEXT,  -- Qual serviço o cliente fez
  testimonial_date DATE DEFAULT CURRENT_DATE,

  -- Visibilidade
  is_visible BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,

  -- Ordem de exibição
  order_index INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_testimonials_professional ON testimonials(professional_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_rating ON testimonials(rating);
CREATE INDEX IF NOT EXISTS idx_testimonials_featured ON testimonials(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_testimonials_order ON testimonials(professional_id, order_index);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_testimonials_updated_at ON testimonials;
CREATE TRIGGER update_testimonials_updated_at
  BEFORE UPDATE ON testimonials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profissionais gerenciam depoimentos" ON testimonials;
CREATE POLICY "Profissionais gerenciam depoimentos"
  ON testimonials FOR ALL
  USING (
    professional_id IN (
      SELECT id FROM professionals WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Depoimentos visíveis são públicos" ON testimonials;
CREATE POLICY "Depoimentos visíveis são públicos"
  ON testimonials FOR SELECT
  USING (is_visible = true);

-- ============================================
-- 5. STORAGE BUCKET: gallery
-- ============================================

-- Inserir bucket se não existir
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gallery',
  'gallery',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- RLS para gallery bucket
DROP POLICY IF EXISTS "Profissionais podem fazer upload no gallery" ON storage.objects;
CREATE POLICY "Profissionais podem fazer upload no gallery"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'gallery' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Qualquer um pode ver imagens do gallery" ON storage.objects;
CREATE POLICY "Qualquer um pode ver imagens do gallery"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'gallery');

DROP POLICY IF EXISTS "Profissionais podem deletar suas imagens do gallery" ON storage.objects;
CREATE POLICY "Profissionais podem deletar suas imagens do gallery"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'gallery' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Profissionais podem atualizar suas imagens do gallery" ON storage.objects;
CREATE POLICY "Profissionais podem atualizar suas imagens do gallery"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'gallery' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================
-- 6. FUNÇÃO: Inicializar seções padrão
-- ============================================

CREATE OR REPLACE FUNCTION initialize_default_sections(p_professional_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Inserir seções padrão se não existirem

  -- Hero (sempre visível)
  INSERT INTO page_sections (professional_id, section_type, order_index, is_visible, data)
  VALUES (
    p_professional_id,
    'hero',
    1,
    true,
    '{"ctaText": "Agendar Agora", "showSocialLinks": false}'::jsonb
  )
  ON CONFLICT (professional_id, section_type) DO NOTHING;

  -- About (oculto por padrão)
  INSERT INTO page_sections (professional_id, section_type, order_index, is_visible, data)
  VALUES (
    p_professional_id,
    'about',
    2,
    false,
    '{"heading": "Sobre Mim", "description": "", "yearsExperience": 0}'::jsonb
  )
  ON CONFLICT (professional_id, section_type) DO NOTHING;

  -- Services (sempre visível)
  INSERT INTO page_sections (professional_id, section_type, order_index, is_visible, data)
  VALUES (
    p_professional_id,
    'services',
    3,
    true,
    '{"heading": "Meus Serviços", "displayMode": "grid", "showPrices": true, "ctaText": "Agendar"}'::jsonb
  )
  ON CONFLICT (professional_id, section_type) DO NOTHING;

  -- Gallery (oculto por padrão)
  INSERT INTO page_sections (professional_id, section_type, order_index, is_visible, data)
  VALUES (
    p_professional_id,
    'gallery',
    4,
    false,
    '{"heading": "Galeria de Trabalhos", "layout": "grid", "columns": 3, "showCategories": true}'::jsonb
  )
  ON CONFLICT (professional_id, section_type) DO NOTHING;

  -- Testimonials (oculto por padrão)
  INSERT INTO page_sections (professional_id, section_type, order_index, is_visible, data)
  VALUES (
    p_professional_id,
    'testimonials',
    5,
    false,
    '{"heading": "O que dizem meus clientes", "displayMode": "grid", "showRatings": true, "maxToShow": 6}'::jsonb
  )
  ON CONFLICT (professional_id, section_type) DO NOTHING;

  -- FAQ (oculto por padrão)
  INSERT INTO page_sections (professional_id, section_type, order_index, is_visible, data)
  VALUES (
    p_professional_id,
    'faq',
    6,
    false,
    '{"heading": "Perguntas Frequentes", "items": []}'::jsonb
  )
  ON CONFLICT (professional_id, section_type) DO NOTHING;

  -- Contact (sempre visível)
  INSERT INTO page_sections (professional_id, section_type, order_index, is_visible, data)
  VALUES (
    p_professional_id,
    'contact',
    7,
    true,
    '{"heading": "Entre em Contato", "showPhone": true, "showWhatsApp": true, "showEmail": false}'::jsonb
  )
  ON CONFLICT (professional_id, section_type) DO NOTHING;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. TRIGGER: Inicializar seções ao criar profissional
-- ============================================

CREATE OR REPLACE FUNCTION auto_initialize_sections()
RETURNS TRIGGER AS $$
BEGIN
  -- Inicializar seções padrão para o novo profissional
  PERFORM initialize_default_sections(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_initialize_sections ON professionals;
CREATE TRIGGER trigger_auto_initialize_sections
  AFTER INSERT ON professionals
  FOR EACH ROW
  EXECUTE FUNCTION auto_initialize_sections();

-- ============================================
-- 8. INICIALIZAR SEÇÕES PARA PROFISSIONAIS EXISTENTES
-- ============================================

-- Inicializar seções para todos os profissionais que ainda não têm
DO $$
DECLARE
  prof RECORD;
BEGIN
  FOR prof IN SELECT id FROM professionals LOOP
    PERFORM initialize_default_sections(prof.id);
  END LOOP;
END $$;

-- ============================================
-- 9. COMENTÁRIOS
-- ============================================

COMMENT ON TABLE page_sections IS 'Seções modulares da landing page de cada profissional';
COMMENT ON TABLE gallery_images IS 'Galeria de fotos de trabalhos realizados';
COMMENT ON TABLE testimonials IS 'Depoimentos e avaliações de clientes';

COMMENT ON FUNCTION initialize_default_sections IS 'Inicializa seções padrão para um profissional';

-- ============================================
-- FINALIZAÇÃO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'Sprint 6 Landing Page Editor migration completed successfully!';
  RAISE NOTICE 'Created: page_sections, gallery_images, testimonials tables';
  RAISE NOTICE 'Created: gallery storage bucket';
  RAISE NOTICE 'Initialized default sections for all existing professionals';
END $$;
