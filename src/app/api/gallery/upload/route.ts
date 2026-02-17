import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const category = formData.get('category') as string;
    const isBeforeAfter = formData.get('isBeforeAfter') === 'true';
    const beforeFile = formData.get('beforeFile') as File;
    const afterFile = formData.get('afterFile') as File;

    if (!file && (!isBeforeAfter || !beforeFile || !afterFile)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    let imageUrl = '';
    let beforeImageUrl = '';
    let afterImageUrl = '';

    // Upload imagem normal
    if (file) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('gallery')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('gallery').getPublicUrl(uploadData.path);

      imageUrl = publicUrl;
    }

    // Upload before/after images
    if (isBeforeAfter && beforeFile && afterFile) {
      const beforeExt = beforeFile.name.split('.').pop();
      const afterExt = afterFile.name.split('.').pop();
      const beforeFileName = `${user.id}/before_${Date.now()}.${beforeExt}`;
      const afterFileName = `${user.id}/after_${Date.now()}.${afterExt}`;

      const [beforeUpload, afterUpload] = await Promise.all([
        supabase.storage.from('gallery').upload(beforeFileName, beforeFile, {
          cacheControl: '3600',
          upsert: false,
        }),
        supabase.storage.from('gallery').upload(afterFileName, afterFile, {
          cacheControl: '3600',
          upsert: false,
        }),
      ]);

      if (beforeUpload.error) throw beforeUpload.error;
      if (afterUpload.error) throw afterUpload.error;

      const beforePublicUrl = supabase.storage.from('gallery').getPublicUrl(beforeUpload.data.path);
      const afterPublicUrl = supabase.storage.from('gallery').getPublicUrl(afterUpload.data.path);

      beforeImageUrl = beforePublicUrl.data.publicUrl;
      afterImageUrl = afterPublicUrl.data.publicUrl;
    }

    // Inserir no banco
    const { data: galleryImage, error: dbError } = await supabase
      .from('gallery_images')
      .insert({
        professional_id: professional.id,
        image_url: imageUrl || beforeImageUrl,
        title: title || null,
        description: description || null,
        category: category || null,
        is_before_after: isBeforeAfter,
        before_image_url: beforeImageUrl || null,
        after_image_url: afterImageUrl || null,
        order_index: 0,
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return NextResponse.json({ image: galleryImage });
  } catch (error) {
    console.error('Error uploading gallery image:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
