'use client';

import { useState } from 'react';
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

      // Generate unique filename
      const fileExt = compressedFile.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const supabase = createClient();
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
    } catch (error) {
      console.error('Upload error:', error);
      alert('Erro ao fazer upload da imagem. Tente novamente.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={className}>
      <input
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        disabled={uploading}
        className="hidden"
        id={`upload-${bucket}`}
      />
      <label htmlFor={`upload-${bucket}`} className="cursor-pointer">
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
      </label>
      {(preview || currentImageUrl) && (
        <p className="text-xs text-green-600 dark:text-green-400 mt-2">
          ✓ Imagem atualizada
        </p>
      )}
    </div>
  );
}
