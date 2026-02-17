import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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
    // Buscar todas as seções
    const { data: sections, error } = await supabase
      .from('page_sections')
      .select('*')
      .eq('professional_id', professional.id)
      .order('order_index', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ sections: sections || [] });
  } catch (error) {
    console.error('Error fetching page sections:', error);
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
    const validTypes = ['hero', 'about', 'services', 'gallery', 'testimonials', 'faq', 'contact'];
    if (!validTypes.includes(section_type)) {
      return NextResponse.json({ error: 'Invalid section type' }, { status: 400 });
    }

    // Upsert (insert or update)
    const { data: section, error } = await supabase
      .from('page_sections')
      .upsert(
        {
          professional_id: professional.id,
          section_type,
          order_index,
          data,
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
    console.error('Error creating/updating page section:', error);
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

    if (!Array.isArray(sections)) {
      return NextResponse.json({ error: 'Sections must be an array' }, { status: 400 });
    }

    // Atualizar todas as seções
    const updates = sections.map(async (section) => {
      const { id, order_index, is_visible } = section;

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
    console.error('Error updating page sections:', error);
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
    console.error('Error hiding page section:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
