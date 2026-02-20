'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Clock, Loader2, Sparkles, Home } from 'lucide-react';
import type { Service } from '@/types/database';

interface ServicesManagerProps {
  services: Service[];
  professionalId: string;
  currency: string;
  businessName: string;
  category: string | null;
}

function formatPrice(price: number, currency: string) {
  const symbols: Record<string, string> = { EUR: '\u20AC', GBP: '\u00A3', USD: '$', BRL: 'R$' };
  const symbol = symbols[currency] || currency;
  return `${symbol}${Number(price).toFixed(0)}`;
}

export function ServicesManager({
  services,
  professionalId,
  currency,
  businessName,
  category,
}: ServicesManagerProps) {
  const router = useRouter();
  const supabase = createClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [deletingService, setDeletingService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingDesc, setGeneratingDesc] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('60');
  const [price, setPrice] = useState('');
  const [serviceLocation, setServiceLocation] = useState('in_salon');
  const [lifetimeDays, setLifetimeDays] = useState('');

  function openCreate() {
    setEditingService(null);
    setName('');
    setDescription('');
    setDurationMinutes('60');
    setPrice('');
    setServiceLocation('in_salon');
    setLifetimeDays('');
    setDialogOpen(true);
  }

  function openEdit(service: Service) {
    setEditingService(service);
    setName(service.name);
    setDescription(service.description || '');
    setDurationMinutes(String(service.duration_minutes));
    setPrice(String(service.price));
    setServiceLocation((service as any).service_location || 'in_salon');
    setLifetimeDays(service.lifetime_days ? String(service.lifetime_days) : '');
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const data = {
      name,
      description: description || null,
      duration_minutes: parseInt(durationMinutes),
      price: parseFloat(price),
      professional_id: professionalId,
      service_location: serviceLocation,
      lifetime_days: lifetimeDays ? parseInt(lifetimeDays) : null,
    };

    if (editingService) {
      await supabase.from('services').update(data).eq('id', editingService.id);
    } else {
      await supabase.from('services').insert({
        ...data,
        is_active: true,
        sort_order: services.length,
      });
    }

    setLoading(false);
    setDialogOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!deletingService) return;
    setLoading(true);
    await supabase.from('services').delete().eq('id', deletingService.id);
    setLoading(false);
    setDeleteDialogOpen(false);
    setDeletingService(null);
    router.refresh();
  }

  async function toggleActive(service: Service) {
    await supabase
      .from('services')
      .update({ is_active: !service.is_active })
      .eq('id', service.id);
    router.refresh();
  }

  async function generateDescription() {
    if (!name) return;
    setGeneratingDesc(true);
    try {
      const res = await fetch('/api/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceName: name,
          businessName,
          category,
        }),
      });
      const data = await res.json();
      if (data.description) setDescription(data.description);
    } catch {
      // silently fail
    }
    setGeneratingDesc(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Serviços</h1>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Adicionar servico
        </Button>
      </div>

      {services.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              Nenhum servico cadastrado. Comece adicionando seu primeiro servico!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {services.map((service) => (
            <Card key={service.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-medium">{service.name}</h3>
                      <Badge
                        variant={service.is_active ? 'default' : 'secondary'}
                        className="text-[10px]"
                      >
                        {service.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                      {(service as any).service_location === 'at_home' && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Home className="h-2.5 w-2.5" /> A domicílio
                        </Badge>
                      )}
                      {(service as any).service_location === 'both' && (
                        <Badge variant="outline" className="text-[10px] gap-1">
                          <Home className="h-2.5 w-2.5" /> Salão ou domicílio
                        </Badge>
                      )}
                    </div>
                    {service.description && (
                      <p className="text-sm text-muted-foreground">
                        {service.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {service.duration_minutes} min
                      </span>
                      <span className="font-semibold text-foreground">
                        {formatPrice(service.price, currency)}
                      </span>
                    </div>
                    {service.lifetime_days && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        🔁 Refazer a cada {service.lifetime_days} dias
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toggleActive(service)}
                      title={service.is_active ? 'Desativar' : 'Ativar'}
                    >
                      <span className="text-xs">
                        {service.is_active ? 'Off' : 'On'}
                      </span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(service)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setDeletingService(service);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingService ? 'Editar servico' : 'Novo servico'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Corte de cabelo"
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="description">Descrição</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={generateDescription}
                  disabled={generatingDesc || !name}
                  className="gap-1 text-xs h-7"
                >
                  {generatingDesc ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  Sugerir com IA
                </Button>
              </div>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o servico (opcional)"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Duracao (min) *</Label>
                <Input
                  id="duration"
                  type="number"
                  min="15"
                  step="15"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Preco *</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Local de atendimento</Label>
              <Select value={serviceLocation} onValueChange={setServiceLocation}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_salon">No salão / estabelecimento</SelectItem>
                  <SelectItem value="at_home">A domicílio (na casa do cliente)</SelectItem>
                  <SelectItem value="both">Ambos (cliente escolhe)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="lifetime">Vida útil (opcional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="lifetime"
                  type="number"
                  min="1"
                  max="365"
                  placeholder="Ex: 20"
                  value={lifetimeDays}
                  onChange={(e) => setLifetimeDays(e.target.value)}
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">dias</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Cliente recebe lembrete para remarcar após este período
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingService ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir servico</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir &ldquo;{deletingService?.name}&rdquo;?
            Está ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={loading}
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
