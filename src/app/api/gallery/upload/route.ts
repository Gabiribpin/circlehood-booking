import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

const MAX_REQUEST_SIZE = 50 * 1024 * 1024; // 50 MB total
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB per file

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

// Magic bytes for supported image formats
const MAGIC_BYTES: [string, number[]][] = [
  ['image/jpeg', [0xFF, 0xD8, 0xFF]],
  ['image/png', [0x89, 0x50, 0x4E, 0x47]],
  ['image/webp', [0x52, 0x49, 0x46, 0x46]], // RIFF
  ['image/gif', [0x47, 0x49, 0x46]],         // GIF
];

async function validateImageFile(file: File): Promise<string | null> {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return `Tipo de arquivo não permitido: ${file.type}. Use JPEG, PNG, WebP ou GIF.`;
  }

  const buffer = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const matchesMagic = MAGIC_BYTES.some(([, bytes]) =>
    bytes.every((b, i) => buffer[i] === b)
  );

  if (!matchesMagic) {
    return 'Arquivo não é uma imagem válida.';
  }

  return null;
}

export async function POST(request: NextRequest) {
  // Validate content-length before parsing body
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_SIZE) {
    return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  }

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

    // Validate individual file sizes and MIME types
    const filesToCheck = [file, beforeFile, afterFile].filter(Boolean) as File[];
    for (const f of filesToCheck) {
      if (f.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: 'File too large. Maximum size is 5MB per file.' },
          { status: 413 }
        );
      }
      const validationError = await validateImageFile(f);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }
    }

    // Sanitize file extension to prevent path traversal
    const safeExt = (name: string) =>
      (name.split('.').pop() || 'bin').replace(/[^a-zA-Z0-9]/g, '');

    let imageUrl = '';
    let beforeImageUrl = '';
    let afterImageUrl = '';

    // Upload imagem normal
    if (file) {
      const fileExt = safeExt(file.name);
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
      const beforeExt = safeExt(beforeFile.name);
      const afterExt = safeExt(afterFile.name);
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
    logger.error('Error uploading gallery image:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
