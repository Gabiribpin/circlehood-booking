'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Upload, Trash2, Edit, X, ImagePlus } from 'lucide-react';
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
  const [images, setImages] = useState<GalleryImage[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [editingImage, setEditingImage] = useState<GalleryImage | null>(null);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [isBeforeAfter, setIsBeforeAfter] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'other',
  });

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
        title: 'Sucesso!',
        description: 'Imagem adicionada à galeria',
      });

      setShowUploadDialog(false);
      setIsBeforeAfter(false);
      setFormData({ title: '', description: '', category: 'other' });
      form.reset();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao fazer upload',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (imageId: string) => {
    if (!confirm('Tem certeza que deseja deletar esta imagem?')) return;

    try {
      const response = await fetch(`/api/gallery?id=${imageId}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Delete failed');

      setImages((prev) => prev.filter((img) => img.id !== imageId));

      toast({
        title: 'Sucesso!',
        description: 'Imagem removida da galeria',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao deletar imagem',
        variant: 'destructive',
      });
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingImage) return;

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      const response = await fetch('/api/gallery', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingImage.id,
          title: formData.get('title'),
          description: formData.get('description'),
          category: formData.get('category'),
        }),
      });

      if (!response.ok) throw new Error('Update failed');

      const { image } = await response.json();
      setImages((prev) => prev.map((img) => (img.id === image.id ? image : img)));

      toast({
        title: 'Sucesso!',
        description: 'Imagem atualizada',
      });

      setEditingImage(null);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao atualizar imagem',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Button */}
      <Card>
        <CardHeader>
          <CardTitle>Adicionar Fotos</CardTitle>
          <CardDescription>
            Faça upload de fotos dos seus trabalhos ou crie comparações antes/depois
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setShowUploadDialog(true)}>
            <ImagePlus className="w-4 h-4 mr-2" />
            Adicionar Nova Foto
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
                    {image.category}
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
                      Editar
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
          <p className="text-muted-foreground mb-4">Nenhuma foto na galeria ainda</p>
          <Button onClick={() => setShowUploadDialog(true)}>Adicionar Primeira Foto</Button>
        </Card>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Adicionar Foto à Galeria</DialogTitle>
            <DialogDescription>
              Faça upload de uma foto ou crie uma comparação antes/depois
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpload} className="space-y-4">
            <div className="flex items-center gap-4 mb-4">
              <Button
                type="button"
                variant={!isBeforeAfter ? 'default' : 'outline'}
                onClick={() => setIsBeforeAfter(false)}
              >
                Foto Simples
              </Button>
              <Button
                type="button"
                variant={isBeforeAfter ? 'default' : 'outline'}
                onClick={() => setIsBeforeAfter(true)}
              >
                Before/After
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
                  <Label htmlFor="beforeFile">Foto Antes</Label>
                  <Input id="beforeFile" name="beforeFile" type="file" accept="image/*" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="afterFile">Foto Depois</Label>
                  <Input id="afterFile" name="afterFile" type="file" accept="image/*" required />
                </div>
              </div>
            )}

            <input type="hidden" name="isBeforeAfter" value={isBeforeAfter ? 'true' : 'false'} />

            <div className="space-y-2">
              <Label htmlFor="title">Título (opcional)</Label>
              <Input
                id="title"
                name="title"
                placeholder="Ex: Corte e coloração"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Descreva o trabalho..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Select
                name="category"
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hair">Cabelo</SelectItem>
                  <SelectItem value="nails">Unhas</SelectItem>
                  <SelectItem value="makeup">Maquiagem</SelectItem>
                  <SelectItem value="skincare">Skincare</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={uploading} className="flex-1">
                {uploading ? (
                  <>
                    <Upload className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Fazer Upload
                  </>
                )}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowUploadDialog(false)}>
                Cancelar
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
              <DialogTitle>Editar Foto</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Título</Label>
                <Input
                  id="edit-title"
                  name="title"
                  defaultValue={editingImage.title || ''}
                  placeholder="Ex: Corte e coloração"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Descrição</Label>
                <Textarea
                  id="edit-description"
                  name="description"
                  defaultValue={editingImage.description || ''}
                  placeholder="Descreva o trabalho..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-category">Categoria</Label>
                <Select name="category" defaultValue={editingImage.category || 'other'}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hair">Cabelo</SelectItem>
                    <SelectItem value="nails">Unhas</SelectItem>
                    <SelectItem value="makeup">Maquiagem</SelectItem>
                    <SelectItem value="skincare">Skincare</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="submit" className="flex-1">
                  Salvar
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditingImage(null)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
