import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET - Buscar todas as imagens da galeria
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const professionalId = searchParams.get('professionalId');
  const category = searchParams.get('category');

  if (!professionalId) {
    return NextResponse.json({ error: 'Professional ID required' }, { status: 400 });
  }

  try {
    let query = supabase
      .from('gallery_images')
      .select('*')
      .eq('professional_id', professionalId)
      .eq('is_visible', true)
      .order('order_index', { ascending: true });

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    const { data: images, error } = await query;

    if (error) throw error;

    return NextResponse.json({ images: images || [] });
  } catch (error) {
    console.error('Error fetching gallery images:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Atualizar uma imagem
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
    const { id, title, description, category, is_visible, order_index } = body;

    if (!id) {
      return NextResponse.json({ error: 'Image ID required' }, { status: 400 });
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (is_visible !== undefined) updateData.is_visible = is_visible;
    if (order_index !== undefined) updateData.order_index = order_index;

    const { data: image, error } = await supabase
      .from('gallery_images')
      .update(updateData)
      .eq('id', id)
      .eq('professional_id', professional.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ image });
  } catch (error) {
    console.error('Error updating gallery image:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Deletar uma imagem
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
    const imageId = searchParams.get('id');

    if (!imageId) {
      return NextResponse.json({ error: 'Image ID required' }, { status: 400 });
    }

    // Buscar imagem para pegar URLs
    const { data: image } = await supabase
      .from('gallery_images')
      .select('*')
      .eq('id', imageId)
      .eq('professional_id', professional.id)
      .single();

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    // Deletar arquivos do storage
    const filesToDelete = [];
    if (image.image_url) {
      const path = image.image_url.split('/gallery/')[1];
      if (path) filesToDelete.push(path);
    }
    if (image.before_image_url) {
      const path = image.before_image_url.split('/gallery/')[1];
      if (path) filesToDelete.push(path);
    }
    if (image.after_image_url) {
      const path = image.after_image_url.split('/gallery/')[1];
      if (path) filesToDelete.push(path);
    }

    if (filesToDelete.length > 0) {
      await supabase.storage.from('gallery').remove(filesToDelete);
    }

    // Deletar do banco
    const { error } = await supabase
      .from('gallery_images')
      .delete()
      .eq('id', imageId)
      .eq('professional_id', professional.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting gallery image:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
