# 🎨 SPRINT 6: LANDING PAGE EDITOR - PLANO DE ARQUITETURA

## 🎯 OBJETIVO

Permitir que profissionais personalizem completamente sua página pública sem conhecimento técnico, usando um editor visual drag-and-drop com seções modulares.

---

## 📐 ARQUITETURA DO SISTEMA

### Conceito: Sistema de Seções Modulares

```
Landing Page = Array de Seções Ordenadas
Cada Seção = { type, order, data, visible, settings }
```

### Fluxo de Dados

```
┌─────────────────────────────────────────────────┐
│  Editor (Dashboard)                             │
│  - Arrastar seções                              │
│  - Reordenar                                    │
│  - Configurar dados                             │
│  - Preview em tempo real                        │
└─────────────────┬───────────────────────────────┘
                  │
                  │ Salvar
                  ▼
┌─────────────────────────────────────────────────┐
│  Database: page_sections table                  │
│  - professional_id                              │
│  - section_type                                 │
│  - order_index                                  │
│  - data (JSONB)                                 │
│  - is_visible                                   │
└─────────────────┬───────────────────────────────┘
                  │
                  │ Query
                  ▼
┌─────────────────────────────────────────────────┐
│  Página Pública /[slug]                         │
│  - Renderiza seções na ordem                    │
│  - Usa data para popular conteúdo               │
│  - Estilos consistentes                         │
└─────────────────────────────────────────────────┘
```

---

## 🗄️ DATABASE SCHEMA

### Nova Tabela: `page_sections`

```sql
CREATE TABLE page_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE NOT NULL,

  -- Tipo da seção
  section_type TEXT NOT NULL,  -- 'hero', 'about', 'services', 'gallery', 'testimonials', 'faq', 'contact'

  -- Ordem de exibição
  order_index INTEGER NOT NULL,

  -- Dados específicos da seção (JSON flexível)
  data JSONB NOT NULL DEFAULT '{}',

  -- Visibilidade
  is_visible BOOLEAN DEFAULT true,

  -- Theme/Settings
  theme TEXT DEFAULT 'default',  -- 'default', 'modern', 'elegant', 'minimalist'

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraint única: professional + tipo (cada tipo aparece uma vez)
  UNIQUE(professional_id, section_type)
);

-- Índices
CREATE INDEX idx_page_sections_professional ON page_sections(professional_id);
CREATE INDEX idx_page_sections_order ON page_sections(professional_id, order_index);
CREATE INDEX idx_page_sections_visible ON page_sections(is_visible) WHERE is_visible = true;

-- RLS
ALTER TABLE page_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissionais gerenciam suas seções"
  ON page_sections FOR ALL
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));

CREATE POLICY "Seções públicas são visíveis para todos"
  ON page_sections FOR SELECT
  USING (is_visible = true);

-- Trigger para updated_at
CREATE TRIGGER update_page_sections_updated_at
  BEFORE UPDATE ON page_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Nova Tabela: `gallery_images`

```sql
CREATE TABLE gallery_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE NOT NULL,

  -- URL da imagem no Supabase Storage
  image_url TEXT NOT NULL,

  -- Metadata
  title TEXT,
  description TEXT,
  category TEXT,  -- 'hair', 'nails', 'makeup', 'before_after'

  -- Before/After
  is_before_after BOOLEAN DEFAULT false,
  before_image_url TEXT,
  after_image_url TEXT,

  -- Ordem de exibição
  order_index INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gallery_images_professional ON gallery_images(professional_id);
CREATE INDEX idx_gallery_images_category ON gallery_images(category);

ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissionais gerenciam suas imagens"
  ON gallery_images FOR ALL
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));

CREATE POLICY "Imagens são públicas"
  ON gallery_images FOR SELECT
  USING (true);
```

### Nova Tabela: `testimonials`

```sql
CREATE TABLE testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID REFERENCES professionals(id) ON DELETE CASCADE NOT NULL,

  -- Dados do cliente
  client_name TEXT NOT NULL,
  client_photo_url TEXT,

  -- Depoimento
  testimonial_text TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),

  -- Metadata
  service_name TEXT,  -- Qual serviço o cliente fez
  date TIMESTAMPTZ DEFAULT NOW(),

  -- Visibilidade
  is_visible BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_testimonials_professional ON testimonials(professional_id);
CREATE INDEX idx_testimonials_rating ON testimonials(rating);

ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profissionais gerenciam depoimentos"
  ON testimonials FOR ALL
  USING (professional_id IN (
    SELECT id FROM professionals WHERE user_id = auth.uid()
  ));

CREATE POLICY "Depoimentos visíveis são públicos"
  ON testimonials FOR SELECT
  USING (is_visible = true);
```

### Storage Bucket: `gallery`

```sql
-- Criar bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('gallery', 'gallery', true);

-- RLS para gallery bucket
CREATE POLICY "Profissionais podem fazer upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'gallery' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Qualquer um pode ver imagens públicas"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'gallery');

CREATE POLICY "Profissionais podem deletar suas imagens"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'gallery' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
```

---

## 🧩 ESTRUTURA DE SEÇÕES

### 1. Hero (já existe, melhorar)

```typescript
interface HeroData {
  title: string;          // Business name
  subtitle: string;       // Bio
  ctaText: string;        // "Agendar Agora"
  backgroundUrl?: string; // Cover image
  avatarUrl?: string;     // Avatar
  showSocialLinks: boolean;
  socialLinks?: {
    instagram?: string;
    facebook?: string;
    tiktok?: string;
  };
}
```

### 2. About (NOVO)

```typescript
interface AboutData {
  heading: string;        // "Sobre Mim"
  description: string;    // Texto longo sobre experiência
  yearsExperience?: number;
  certifications?: Array<{
    name: string;
    institution: string;
    year: number;
  }>;
  specialties?: string[]; // ['Coloração', 'Mechas', 'Ombré']
  imageUrl?: string;      // Foto do profissional trabalhando
}
```

### 3. Services (já existe, expandir)

```typescript
interface ServicesData {
  heading: string;        // "Meus Serviços"
  description?: string;
  displayMode: 'grid' | 'list';
  showPrices: boolean;
  showDuration: boolean;
  showDescription: boolean;
  ctaText: string;        // "Agendar"
}
```

### 4. Gallery (NOVO)

```typescript
interface GalleryData {
  heading: string;        // "Galeria de Trabalhos"
  description?: string;
  layout: 'grid' | 'masonry' | 'carousel';
  columns: 2 | 3 | 4;
  showCategories: boolean;
  categories?: string[];  // Filtros
}
```

### 5. Testimonials (NOVO)

```typescript
interface TestimonialsData {
  heading: string;        // "O que dizem meus clientes"
  description?: string;
  displayMode: 'grid' | 'carousel';
  showRatings: boolean;
  showPhotos: boolean;
  maxToShow: number;      // Quantos mostrar
}
```

### 6. FAQ (NOVO)

```typescript
interface FAQData {
  heading: string;        // "Perguntas Frequentes"
  items: Array<{
    question: string;
    answer: string;
  }>;
}
```

### 7. Contact (já existe, melhorar)

```typescript
interface ContactData {
  heading: string;        // "Entre em Contato"
  showPhone: boolean;
  showEmail: boolean;
  showWhatsApp: boolean;
  showAddress: boolean;
  showMap: boolean;
  mapEmbedUrl?: string;   // Google Maps embed
}
```

---

## 🎨 SISTEMA DE TEMAS

### Temas Disponíveis

```typescript
const themes = {
  default: {
    primary: '#667eea',
    secondary: '#764ba2',
    accent: '#f093fb',
    background: '#ffffff',
    text: '#333333',
  },
  modern: {
    primary: '#000000',
    secondary: '#ff6b6b',
    accent: '#ffd93d',
    background: '#f8f9fa',
    text: '#1a1a1a',
  },
  elegant: {
    primary: '#c89d66',
    secondary: '#8b7355',
    accent: '#f4e4d7',
    background: '#fefefe',
    text: '#2c2c2c',
  },
  minimalist: {
    primary: '#4a5568',
    secondary: '#718096',
    accent: '#cbd5e0',
    background: '#ffffff',
    text: '#2d3748',
  },
};
```

---

## 💻 IMPLEMENTAÇÃO FRONTEND

### Estrutura de Arquivos

```
src/
├── app/
│   ├── (dashboard)/
│   │   └── my-page-editor/
│   │       ├── page.tsx                  # Server component (auth + fetch)
│   │       └── page-editor.tsx           # Client component (editor)
│   └── [slug]/
│       └── page.tsx                      # Renderiza página pública
├── components/
│   ├── page-editor/
│   │   ├── editor-sidebar.tsx            # Lista de seções disponíveis
│   │   ├── editor-canvas.tsx             # Preview da página
│   │   ├── section-configurator.tsx      # Form para editar seção
│   │   └── section-list.tsx              # Lista ordenada (drag)
│   └── public-page/
│       ├── section-hero.tsx
│       ├── section-about.tsx
│       ├── section-services.tsx
│       ├── section-gallery.tsx
│       ├── section-testimonials.tsx
│       ├── section-faq.tsx
│       └── section-contact.tsx
└── lib/
    └── page-sections/
        ├── types.ts                      # TypeScript interfaces
        ├── defaults.ts                   # Dados padrão para cada seção
        └── validators.ts                 # Validação de dados
```

---

## 🔄 FLUXO DE IMPLEMENTAÇÃO

### Fase 1: Database & API (2-3 dias)
1. ✅ Criar migration SQL com tabelas
2. ✅ API: GET/POST/PUT/DELETE para `page_sections`
3. ✅ API: Upload de imagens para galeria
4. ✅ API: CRUD de testimonials

### Fase 2: Editor (3-4 dias)
5. ✅ Página `/my-page-editor`
6. ✅ Drag & drop de seções (dnd-kit)
7. ✅ Configurador de cada tipo de seção
8. ✅ Preview em tempo real
9. ✅ Salvar/Publicar

### Fase 3: Renderização Pública (2-3 dias)
10. ✅ Atualizar `[slug]/page.tsx` para buscar seções
11. ✅ Componentes de cada seção
12. ✅ Sistema de temas
13. ✅ Responsividade

### Fase 4: Features Avançadas (2-3 dias)
14. ✅ Upload de galeria (múltiplas imagens)
15. ✅ Before/After slider
16. ✅ Testimonials com ratings
17. ✅ SEO (meta tags dinâmicas)

---

## 📦 DEPENDÊNCIAS

```json
{
  "dependencies": {
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "react-before-after-slider-component": "^1.1.8",
    "react-dropzone": "^14.2.3",
    "react-image-gallery": "^1.3.0"
  }
}
```

---

## 🎯 ORDEM DE IMPLEMENTAÇÃO

### Task 1: Database Migration
- Criar todas as tabelas
- Configurar RLS
- Criar bucket gallery

### Task 2: API Endpoints
- `/api/page-sections` (CRUD)
- `/api/gallery/upload` (Upload múltiplo)
- `/api/testimonials` (CRUD)

### Task 3: Editor Base
- Página editor
- Lista de seções disponíveis
- Drag & drop

### Task 4: Configuradores
- Form para cada tipo de seção
- Validação
- Preview

### Task 5: Renderização Pública
- Atualizar página [slug]
- Componentes de seções
- Sistema de temas

### Task 6: Gallery & Testimonials
- Upload de imagens
- Before/After slider
- Sistema de reviews

### Task 7: SEO & Polish
- Meta tags dinâmicas
- Open Graph
- Testes finais

---

## 🚀 PRÓXIMO PASSO

Vou começar implementando a **Fase 1: Database & API**.

Pronta para começar? 🎨
