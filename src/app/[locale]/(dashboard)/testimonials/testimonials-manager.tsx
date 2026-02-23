'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Star, Trash2, Edit, Plus, MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Testimonial {
  id: string;
  client_name: string;
  client_photo_url?: string;
  testimonial_text: string;
  rating: number;
  service_name?: string;
  testimonial_date: string;
  is_visible: boolean;
  is_featured: boolean;
}

interface TestimonialsManagerProps {
  professionalId: string;
  initialTestimonials: Testimonial[];
}

export function TestimonialsManager({ professionalId, initialTestimonials }: TestimonialsManagerProps) {
  const [testimonials, setTestimonials] = useState<Testimonial[]>(initialTestimonials);
  const [showDialog, setShowDialog] = useState(false);
  const [editingTestimonial, setEditingTestimonial] = useState<Testimonial | null>(null);
  const [selectedRating, setSelectedRating] = useState(5);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data = {
      client_name: formData.get('client_name') as string,
      testimonial_text: formData.get('testimonial_text') as string,
      rating: selectedRating,
      service_name: formData.get('service_name') as string,
      testimonial_date: formData.get('testimonial_date') as string,
    };

    try {
      if (editingTestimonial) {
        // Update
        const response = await fetch('/api/testimonials', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingTestimonial.id, ...data }),
        });

        if (!response.ok) throw new Error('Update failed');

        const { testimonial } = await response.json();
        setTestimonials((prev) =>
          prev.map((t) => (t.id === testimonial.id ? testimonial : t))
        );

        toast({
          title: 'Sucesso!',
          description: 'Depoimento atualizado',
        });
      } else {
        // Create
        const response = await fetch('/api/testimonials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        if (!response.ok) throw new Error('Create failed');

        const { testimonial } = await response.json();
        setTestimonials((prev) => [testimonial, ...prev]);

        toast({
          title: 'Sucesso!',
          description: 'Depoimento adicionado',
        });
      }

      setShowDialog(false);
      setEditingTestimonial(null);
      setSelectedRating(5);
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao salvar depoimento',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este depoimento?')) return;

    try {
      const response = await fetch(`/api/testimonials?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Delete failed');

      setTestimonials((prev) => prev.filter((t) => t.id !== id));

      toast({
        title: 'Sucesso!',
        description: 'Depoimento removido',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao deletar depoimento',
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (testimonial: Testimonial) => {
    setEditingTestimonial(testimonial);
    setSelectedRating(testimonial.rating);
    setShowDialog(true);
  };

  const handleNewTestimonial = () => {
    setEditingTestimonial(null);
    setSelectedRating(5);
    setShowDialog(true);
  };

  const renderStars = (rating: number, interactive = false) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => interactive && setSelectedRating(star)}
            disabled={!interactive}
            className={interactive ? 'cursor-pointer hover:scale-110 transition-transform' : ''}
          >
            <Star
              className={`w-5 h-5 ${
                star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Add Button */}
      <Card>
        <CardHeader>
          <CardTitle>Adicionar Depoimentos</CardTitle>
          <CardDescription>
            Compartilhe avaliações positivas de clientes satisfeitos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleNewTestimonial}>
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Depoimento
          </Button>
        </CardContent>
      </Card>

      {/* Testimonials List */}
      {testimonials.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.id}>
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-lg">{testimonial.client_name}</p>
                      {testimonial.service_name && (
                        <p className="text-sm text-muted-foreground">{testimonial.service_name}</p>
                      )}
                    </div>
                    {renderStars(testimonial.rating)}
                  </div>

                  <p className="text-gray-700 italic">"{testimonial.testimonial_text}"</p>

                  <p className="text-xs text-muted-foreground">
                    {new Date(testimonial.testimonial_date).toLocaleDateString('pt-BR')}
                  </p>

                  <div className="flex gap-2 pt-3 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(testimonial)}
                      className="flex-1"
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(testimonial.id)}
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
          <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">Nenhum depoimento ainda</p>
          <Button onClick={handleNewTestimonial}>Adicionar Primeiro Depoimento</Button>
        </Card>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTestimonial ? 'Editar Depoimento' : 'Adicionar Depoimento'}
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do depoimento do cliente
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="client_name">Nome do Cliente *</Label>
              <Input
                id="client_name"
                name="client_name"
                defaultValue={editingTestimonial?.client_name || ''}
                placeholder="Ex: Maria Silva"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="service_name">Serviço (opcional)</Label>
              <Input
                id="service_name"
                name="service_name"
                defaultValue={editingTestimonial?.service_name || ''}
                placeholder="Ex: Corte e Escova"
              />
            </div>

            <div className="space-y-2">
              <Label>Avaliação *</Label>
              {renderStars(selectedRating, true)}
            </div>

            <div className="space-y-2">
              <Label htmlFor="testimonial_text">Depoimento *</Label>
              <Textarea
                id="testimonial_text"
                name="testimonial_text"
                defaultValue={editingTestimonial?.testimonial_text || ''}
                placeholder="Depoimento do cliente..."
                rows={4}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="testimonial_date">Data</Label>
              <Input
                id="testimonial_date"
                name="testimonial_date"
                type="date"
                defaultValue={
                  editingTestimonial?.testimonial_date ||
                  new Date().toISOString().split('T')[0]
                }
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1">
                {editingTestimonial ? 'Atualizar' : 'Adicionar'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDialog(false);
                  setEditingTestimonial(null);
                }}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
