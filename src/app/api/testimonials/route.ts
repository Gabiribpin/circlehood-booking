import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest, NextResponse } from 'next/server';

// GET - Buscar depoimentos
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const professionalId = searchParams.get('professionalId');
  const featuredOnly = searchParams.get('featuredOnly') === 'true';
  const includeHidden = searchParams.get('includeHidden') === 'true';

  if (!professionalId) {
    return NextResponse.json({ error: 'Professional ID required' }, { status: 400 });
  }

  // includeHidden requer auth (dashboard)
  if (includeHidden) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: professional } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!professional || professional.id !== professionalId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  try {
    let query = supabase
      .from('testimonials')
      .select('*')
      .eq('professional_id', professionalId)
      .order('order_index', { ascending: true });

    if (!includeHidden) {
      query = query.eq('is_visible', true);
    }

    if (featuredOnly) {
      query = query.eq('is_featured', true);
    }

    const { data: testimonials, error } = await query;

    if (error) throw error;

    return NextResponse.json({ testimonials: testimonials || [] });
  } catch (error) {
    console.error('Error fetching testimonials:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Criar um novo depoimento
export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    client_name,
    testimonial_text,
    rating,
    service_name,
    professional_id: bodyProfessionalId,
  } = body;

  // Validar campos obrigatórios
  if (!client_name || !testimonial_text || !rating) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Validar rating
  if (rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
  }

  // ── Fluxo público (professional_id no body → visitante enviando depoimento) ──
  if (bodyProfessionalId) {
    try {
      const adminClient = createAdminClient();

      const { data: professional } = await adminClient
        .from('professionals')
        .select('id')
        .eq('id', bodyProfessionalId)
        .single();

      if (!professional) {
        return NextResponse.json({ error: 'Professional not found' }, { status: 404 });
      }

      const { data: testimonial, error } = await adminClient
        .from('testimonials')
        .insert({
          professional_id: bodyProfessionalId,
          client_name,
          client_photo_url: null,
          testimonial_text,
          rating,
          service_name: service_name || null,
          testimonial_date: new Date().toISOString().split('T')[0],
          is_visible: false,
          is_featured: false,
          order_index: 0,
        })
        .select()
        .single();

      if (error) throw error;

      return NextResponse.json({ testimonial }, { status: 201 });
    } catch (error) {
      console.error('Error creating public testimonial:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }

  // ── Fluxo autenticado (sem professional_id → profissional via dashboard) ──
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: professional } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!professional) {
    return NextResponse.json({ error: 'Professional not found' }, { status: 404 });
  }

  try {
    const { data: testimonial, error } = await supabase
      .from('testimonials')
      .insert({
        professional_id: professional.id,
        client_name,
        client_photo_url: null,
        testimonial_text,
        rating,
        service_name: service_name || null,
        testimonial_date: new Date().toISOString().split('T')[0],
        is_visible: true,
        is_featured: false,
        order_index: 0,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ testimonial });
  } catch (error) {
    console.error('Error creating testimonial:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Atualizar um depoimento
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
    const {
      id,
      client_name,
      client_photo_url,
      testimonial_text,
      rating,
      service_name,
      testimonial_date,
      is_visible,
      is_featured,
      order_index,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Testimonial ID required' }, { status: 400 });
    }

    const updateData: any = {};
    if (client_name !== undefined) updateData.client_name = client_name;
    if (client_photo_url !== undefined) updateData.client_photo_url = client_photo_url;
    if (testimonial_text !== undefined) updateData.testimonial_text = testimonial_text;
    if (rating !== undefined) {
      if (rating < 1 || rating > 5) {
        return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
      }
      updateData.rating = rating;
    }
    if (service_name !== undefined) updateData.service_name = service_name;
    if (testimonial_date !== undefined) updateData.testimonial_date = testimonial_date;
    if (is_visible !== undefined) updateData.is_visible = is_visible;
    if (is_featured !== undefined) updateData.is_featured = is_featured;
    if (order_index !== undefined) updateData.order_index = order_index;

    const { data: testimonial, error } = await supabase
      .from('testimonials')
      .update(updateData)
      .eq('id', id)
      .eq('professional_id', professional.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ testimonial });
  } catch (error) {
    console.error('Error updating testimonial:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Deletar um depoimento
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
    const testimonialId = searchParams.get('id');

    if (!testimonialId) {
      return NextResponse.json({ error: 'Testimonial ID required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('testimonials')
      .delete()
      .eq('id', testimonialId)
      .eq('professional_id', professional.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting testimonial:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
