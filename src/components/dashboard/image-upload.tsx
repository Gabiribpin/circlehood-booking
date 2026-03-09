'use client';
import { logger } from '@/lib/logger';

import { useState, useRef, useId } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Upload, Loader2 } from 'lucide-react';
import imageCompression from 'browser-image-compression';

interface ImageUploadProps {
  currentImageUrl?: string;
  onUploadComplete: (url: string) => void;
  bucket: 'avatars' | 'covers';
  accept?: string;
  maxSizeMB?: number;
  className?: string;
  children?: React.ReactNode;
}

export function ImageUpload({
  currentImageUrl,
  onUploadComplete,
  bucket,
  accept = 'image/*',
  maxSizeMB = 0.5,
  className,
  children,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uniqueId = useId();

  function triggerFileInput() {
    inputRef.current?.click();
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);

    try {
      // Compress image
      const options = {
        maxSizeMB,
        maxWidthOrHeight: bucket === 'avatars' ? 500 : 1920,
        useWebWorker: true,
      };

      const compressedFile = await imageCompression(file, options);

      // Upload to Supabase Storage
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Generate unique filename with user folder for RLS isolation
      const fileExt = compressedFile.name.split('.').pop();
      const fileName = `${user.id}/${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, compressedFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(data.path);

      // Set preview
      setPreview(publicUrl);

      // Call callback
      onUploadComplete(publicUrl);
    } catch (error: any) {
      logger.error('❌ Upload error full object:', error);
      logger.error('❌ error.message:', error?.message);
      logger.error('❌ error.statusCode:', error?.statusCode);
      logger.error('❌ error.error:', error?.error);
      const msg = error?.message ?? error?.error ?? JSON.stringify(error);
      alert(`Erro upload (bucket: ${bucket}): ${msg}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        disabled={uploading}
        className="hidden"
        id={`upload-${uniqueId}`}
      />
      <div onClick={triggerFileInput} className="cursor-pointer">
        {children || (
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            asChild
          >
            <span>
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {uploading ? 'Enviando...' : 'Escolher imagem'}
            </span>
          </Button>
        )}
      </div>
      {(preview || currentImageUrl) && (
        <p className="text-xs text-green-600 dark:text-green-400 mt-2">
          ✓ Imagem atualizada
        </p>
      )}
    </div>
  );
}
