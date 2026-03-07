import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const MAX_STRING = 500;
const MAX_URL = 2000;

const heroDataSchema = z.object({
  title: z.string().max(MAX_STRING).optional(),
  subtitle: z.string().max(MAX_STRING).optional(),
  ctaText: z.string().max(MAX_STRING),
  backgroundUrl: z.string().max(MAX_URL).optional(),
  avatarUrl: z.string().max(MAX_URL).optional(),
  showSocialLinks: z.boolean(),
  socialLinks: z.object({
    instagram: z.string().max(MAX_URL).optional(),
    facebook: z.string().max(MAX_URL).optional(),
    tiktok: z.string().max(MAX_URL).optional(),
  }).optional(),
});

const aboutDataSchema = z.object({
  heading: z.string().max(MAX_STRING),
  description: z.string().max(5000),
  yearsExperience: z.number().int().min(0).max(100).optional(),
  certifications: z.array(z.object({
    name: z.string().max(MAX_STRING),
    institution: z.string().max(MAX_STRING),
    year: z.number().int().min(1900).max(2100),
  })).max(50).optional(),
  specialties: z.array(z.string().max(MAX_STRING)).max(50).optional(),
  imageUrl: z.string().max(MAX_URL).optional(),
});

const servicesDataSchema = z.object({
  heading: z.string().max(MAX_STRING),
  description: z.string().max(2000).optional(),
  displayMode: z.enum(['grid', 'list']),
  showPrices: z.boolean(),
  showDuration: z.boolean(),
  showDescription: z.boolean(),
  ctaText: z.string().max(MAX_STRING),
});

const galleryDataSchema = z.object({
  heading: z.string().max(MAX_STRING),
  description: z.string().max(2000).optional(),
  layout: z.enum(['grid', 'masonry', 'carousel']),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  showCategories: z.boolean(),
  categories: z.array(z.string().max(MAX_STRING)).max(50).optional(),
});

const testimonialsDataSchema = z.object({
  heading: z.string().max(MAX_STRING),
  description: z.string().max(2000).optional(),
  displayMode: z.enum(['grid', 'carousel']),
  showRatings: z.boolean(),
  showPhotos: z.boolean(),
  maxToShow: z.number().int().min(1).max(100),
});

const faqDataSchema = z.object({
  heading: z.string().max(MAX_STRING),
  items: z.array(z.object({
    question: z.string().max(1000),
    answer: z.string().max(5000),
  })).max(100),
});

const contactDataSchema = z.object({
  heading: z.string().max(MAX_STRING),
  showPhone: z.boolean(),
  showEmail: z.boolean(),
  showWhatsApp: z.boolean(),
  showAddress: z.boolean(),
  showMap: z.boolean(),
  mapEmbedUrl: z.string().max(MAX_URL).optional(),
});

const VALID_TYPES = ['hero', 'about', 'services', 'gallery', 'testimonials', 'faq', 'contact'] as const;
type ValidSectionType = typeof VALID_TYPES[number];

const dataSchemaMap: Record<ValidSectionType, z.ZodType> = {
  hero: heroDataSchema,
  about: aboutDataSchema,
  services: servicesDataSchema,
  gallery: galleryDataSchema,
  testimonials: testimonialsDataSchema,
  faq: faqDataSchema,
  contact: contactDataSchema,
};

// GET - Buscar todas as seções do profissional
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get professional_id
  const { data: professional } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!professional) {
    return NextResponse.json({ error: 'Professional not found' }, { status: 404 });
  }

  try {
    // Buscar seções (max 7 types per professional, limit as defensive guard)
    const { data: sections, error } = await supabase
      .from('page_sections')
      .select('*')
      .eq('professional_id', professional.id)
      .order('order_index', { ascending: true })
      .limit(50);

    if (error) throw error;

    return NextResponse.json({ sections: sections || [] });
  } catch (error) {
    logger.error('Error fetching page sections:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Criar ou atualizar uma seção
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get professional_id
  const { data: professional } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!professional) {
    return NextResponse.json({ error: 'Professional not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { section_type, order_index, data, is_visible, theme } = body;

    // Validar campos obrigatórios
    if (!section_type || order_index === undefined || !data) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validar section_type
    if (!VALID_TYPES.includes(section_type)) {
      return NextResponse.json({ error: 'Invalid section type' }, { status: 400 });
    }

    // Validar order_index
    if (typeof order_index !== 'number' || !Number.isInteger(order_index) || order_index < 0 || order_index > 100) {
      return NextResponse.json({ error: 'Invalid order_index' }, { status: 400 });
    }

    // Validar theme
    const validThemes = ['default', 'modern', 'elegant', 'minimalist'];
    if (theme && !validThemes.includes(theme)) {
      return NextResponse.json({ error: 'Invalid theme' }, { status: 400 });
    }

    // Validar data contra schema do section_type
    const dataSchema = dataSchemaMap[section_type as ValidSectionType];
    const dataParsed = dataSchema.safeParse(data);
    if (!dataParsed.success) {
      return NextResponse.json({ error: dataParsed.error.issues[0]?.message || 'Invalid data' }, { status: 400 });
    }

    // Upsert (insert or update)
    const { data: section, error } = await supabase
      .from('page_sections')
      .upsert(
        {
          professional_id: professional.id,
          section_type,
          order_index,
          data: dataParsed.data,
          is_visible: is_visible ?? true,
          theme: theme || 'default',
        },
        {
          onConflict: 'professional_id,section_type',
        }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ section });
  } catch (error) {
    logger.error('Error creating/updating page section:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Atualizar múltiplas seções (bulk update para reordenação)
export async function PUT(request: NextRequest) {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get professional_id
  const { data: professional } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!professional) {
    return NextResponse.json({ error: 'Professional not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { sections } = body;

    if (!Array.isArray(sections) || sections.length > 20) {
      return NextResponse.json({ error: 'Sections must be an array (max 20)' }, { status: 400 });
    }

    const bulkItemSchema = z.object({
      id: z.string().uuid(),
      order_index: z.number().int().min(0).max(100),
      is_visible: z.boolean(),
    });

    // Atualizar todas as seções
    const updates = sections.map(async (section) => {
      const parsed = bulkItemSchema.safeParse(section);
      if (!parsed.success) return null;
      const { id, order_index, is_visible } = parsed.data;

      return supabase
        .from('page_sections')
        .update({ order_index, is_visible })
        .eq('id', id)
        .eq('professional_id', professional.id);
    });

    await Promise.all(updates);

    // Buscar seções atualizadas
    const { data: updatedSections } = await supabase
      .from('page_sections')
      .select('*')
      .eq('professional_id', professional.id)
      .order('order_index', { ascending: true });

    return NextResponse.json({ sections: updatedSections || [] });
  } catch (error) {
    logger.error('Error updating page sections:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Resetar uma seção para padrão (na verdade só oculta)
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get professional_id
  const { data: professional } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!professional) {
    return NextResponse.json({ error: 'Professional not found' }, { status: 404 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const sectionId = searchParams.get('id');

    if (!sectionId) {
      return NextResponse.json({ error: 'Section ID required' }, { status: 400 });
    }

    // Ocultar seção ao invés de deletar
    const { data, error } = await supabase
      .from('page_sections')
      .update({ is_visible: false })
      .eq('id', sectionId)
      .eq('professional_id', professional.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ section: data });
  } catch (error) {
    logger.error('Error hiding page section:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
