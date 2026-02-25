'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Upload, Trash2, Edit, ImagePlus, Share2, Copy, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface GalleryImage {
  id: string;
  image_url: string;
  title?: string;
  description?: string;
  category?: string;
  is_before_after: boolean;
  before_image_url?: string;
  after_image_url?: string;
  order_index: number;
}

interface GalleryManagerProps {
  professionalId: string;
  initialImages: GalleryImage[];
}

export function GalleryManager({ professionalId, initialImages }: GalleryManagerProps) {
  const t = useTranslations('gallery');
  const tc = useTranslations('common');

  const [images, setImages] = useState<GalleryImage[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [editingImage, setEditingImage] = useState<GalleryImage | null>(null);
  const [editCategory, setEditCategory] = useState('other');
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [isBeforeAfter, setIsBeforeAfter] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'other',
  });

  const CATEGORY_LABELS: Record<string, string> = {
    hair: t('categoryHair'),
    nails: t('categoryNails'),
    makeup: t('categoryMakeup'),
    skincare: t('categorySkincare'),
    other: t('categoryOther'),
  };

  function getCategoryLabel(category?: string): string {
    if (!category) return '';
    return CATEGORY_LABELS[category] ?? category;
  }

  // Sync edit category state when opening edit dialog
  useEffect(() => {
    if (editingImage) {
      setEditCategory(editingImage.category || 'other');
    }
  }, [editingImage]);

  const handleUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploading(true);

    const form = e.currentTarget;
    const formDataObj = new FormData(form);

    try {
      const response = await fetch('/api/gallery/upload', {
        method: 'POST',
        body: formDataObj,
      });

      if (!response.ok) throw new Error('Upload failed');

      const { image } = await response.json();
      setImages((prev) => [...prev, image]);

      toast({
        title: tc('success'),
        description: t('imageAdded'),
      });

      setShowUploadDialog(false);
      setIsBeforeAfter(false);
      setFormData({ title: '', description: '', category: 'other' });
      form.reset();
    } catch (error) {
      toast({
        title: tc('error'),
        description: t('uploadError'),
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (imageId: string) => {
    if (!confirm(t('confirmDelete'))) return;

    try {
      const response = await fetch(`/api/gallery?id=${imageId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Delete failed');

      setImages((prev) => prev.filter((img) => img.id !== imageId));

      toast({
        title: tc('success'),
        description: t('imageRemoved'),
      });
    } catch (error) {
      toast({
        title: tc('error'),
        description: t('deleteError'),
        variant: 'destructive',
      });
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingImage) return;

    const form = e.currentTarget;
    const fd = new FormData(form);

    try {
      const response = await fetch('/api/gallery', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingImage.id,
          title: fd.get('title'),
          description: fd.get('description'),
          category: editCategory,
        }),
      });

      if (!response.ok) throw new Error('Update failed');

      const { image } = await response.json();
      setImages((prev) => prev.map((img) => (img.id === image.id ? image : img)));

      toast({
        title: tc('success'),
        description: t('imageUpdated'),
      });

      setEditingImage(null);
    } catch (error) {
      toast({
        title: tc('error'),
        description: t('updateError'),
        variant: 'destructive',
      });
    }
  };

  function handleShareImage(image: GalleryImage) {
    const url = image.image_url;
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({
        url,
        title: image.title ?? t('myWork'),
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setCopiedId(image.id);
        setTimeout(() => setCopiedId(null), 2000);
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload Button */}
      <Card>
        <CardHeader>
          <CardTitle>{t('cardTitle')}</CardTitle>
          <CardDescription>{t('cardDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setShowUploadDialog(true)}>
            <ImagePlus className="w-4 h-4 mr-2" />
            {t('addNewPhoto')}
          </Button>
        </CardContent>
      </Card>

      {/* Gallery Grid */}
      {images.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {images.map((image) => (
            <Card key={image.id} className="overflow-hidden">
              <div className="relative aspect-square">
                <img
                  src={image.image_url}
                  alt={image.title || ''}
                  className="w-full h-full object-cover"
                />
                {image.category && (
                  <span className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                    {getCategoryLabel(image.category)}
                  </span>
                )}
              </div>
              <CardContent className="p-4">
                <div className="space-y-2">
                  {image.title && <p className="font-semibold">{image.title}</p>}
                  {image.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{image.description}</p>
                  )}
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditingImage(image)}
                      className="flex-1"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      {tc('edit')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleShareImage(image)}
                      title="Compartilhar foto"
                    >
                      {copiedId === image.id ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Share2 className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(image.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <ImagePlus className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">{t('noPhotos')}</p>
          <Button onClick={() => setShowUploadDialog(true)}>{t('addFirstPhoto')}</Button>
        </Card>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('dialogTitle')}</DialogTitle>
            <DialogDescription>{t('dialogDesc')}</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpload} className="space-y-4">
            <div className="flex items-center gap-4 mb-4">
              <Button
                type="button"
                variant={!isBeforeAfter ? 'default' : 'outline'}
                onClick={() => setIsBeforeAfter(false)}
              >
                {t('simplePhoto')}
              </Button>
              <Button
                type="button"
                variant={isBeforeAfter ? 'default' : 'outline'}
                onClick={() => setIsBeforeAfter(true)}
              >
                {t('beforeAfter')}
              </Button>
            </div>

            {!isBeforeAfter ? (
              <div className="space-y-2">
                <Label htmlFor="file">Foto</Label>
                <Input id="file" name="file" type="file" accept="image/*" required />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="beforeFile">{t('photoBefore')}</Label>
                  <Input id="beforeFile" name="beforeFile" type="file" accept="image/*" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="afterFile">{t('photoAfter')}</Label>
                  <Input id="afterFile" name="afterFile" type="file" accept="image/*" required />
                </div>
              </div>
            )}

            <input type="hidden" name="isBeforeAfter" value={isBeforeAfter ? 'true' : 'false'} />

            <div className="space-y-2">
              <Label htmlFor="title">{t('titleOptional')}</Label>
              <Input
                id="title"
                name="title"
                placeholder={t('titlePlaceholder')}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('descriptionOptional')}</Label>
              <Textarea
                id="description"
                name="description"
                placeholder={t('descriptionPlaceholder')}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">{t('category')}</Label>
              <Select
                name="category"
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hair">{t('categoryHair')}</SelectItem>
                  <SelectItem value="nails">{t('categoryNails')}</SelectItem>
                  <SelectItem value="makeup">{t('categoryMakeup')}</SelectItem>
                  <SelectItem value="skincare">{t('categorySkincare')}</SelectItem>
                  <SelectItem value="other">{t('categoryOther')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={uploading} className="flex-1">
                {uploading ? (
                  <>
                    <Upload className="w-4 h-4 mr-2 animate-spin" />
                    {t('uploading')}
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    {t('uploadBtn')}
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowUploadDialog(false)}>
                {tc('cancel')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      {editingImage && (
        <Dialog open={!!editingImage} onOpenChange={() => setEditingImage(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('editPhoto')}</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">{t('titleOptional')}</Label>
                <Input
                  id="edit-title"
                  name="title"
                  defaultValue={editingImage.title || ''}
                  placeholder={t('titlePlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">{t('descriptionOptional')}</Label>
                <Textarea
                  id="edit-description"
                  name="description"
                  defaultValue={editingImage.description || ''}
                  placeholder={t('descriptionPlaceholder')}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-category">{t('category')}</Label>
                <Select
                  value={editCategory}
                  onValueChange={setEditCategory}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hair">{t('categoryHair')}</SelectItem>
                    <SelectItem value="nails">{t('categoryNails')}</SelectItem>
                    <SelectItem value="makeup">{t('categoryMakeup')}</SelectItem>
                    <SelectItem value="skincare">{t('categorySkincare')}</SelectItem>
                    <SelectItem value="other">{t('categoryOther')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">
                  {tc('save')}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditingImage(null)}>
                  {tc('cancel')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
