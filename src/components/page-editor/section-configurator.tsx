'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { AutoTranslateButton } from './auto-translate-button';
import { BeforeAfterSlider } from './before-after-slider';

interface SectionConfiguratorProps {
  section: any;
  onSave: (section: any) => void;
  onCancel: () => void;
}

export function SectionConfigurator({ section, onSave, onCancel }: SectionConfiguratorProps) {
  const [data, setData] = useState(section.data || {});
  const [isVisible, setIsVisible] = useState(section.is_visible);

  // Extrai o texto principal da seção para tradução
  const getTranslatableContent = (): string => {
    const parts: string[] = [];
    if (data.heading) parts.push(data.heading);
    if (data.description) parts.push(data.description);
    if (data.ctaText) parts.push(data.ctaText);
    return parts.join('\n\n');
  };

  const handleTranslated = (translations: Record<string, string>) => {
    setData((prev: any) => ({ ...prev, translations }));
  };

  const handleSave = () => {
    onSave({
      ...section,
      data,
      is_visible: isVisible,
    });
  };

  const updateData = (key: string, value: any) => {
    setData((prev: any) => ({ ...prev, [key]: value }));
  };

  const sectionTitles: Record<string, string> = {
    hero: 'Hero / Banner Principal',
    about: 'Sobre Mim',
    services: 'Serviços',
    gallery: 'Galeria',
    testimonials: 'Depoimentos',
    faq: 'Perguntas Frequentes',
    contact: 'Contato',
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{sectionTitles[section.section_type] || section.section_type}</CardTitle>
            <CardDescription>Configure os dados desta seção</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Visibilidade */}
        <div className="flex items-center justify-between">
          <Label htmlFor="visible">Seção Visível</Label>
          <Switch id="visible" checked={isVisible} onCheckedChange={setIsVisible} />
        </div>

        {/* Campos específicos por tipo de seção */}
        {section.section_type === 'hero' && (
          <>
            <div className="space-y-2">
              <Label>Texto do Botão</Label>
              <Input
                value={data.ctaText || ''}
                onChange={(e) => updateData('ctaText', e.target.value)}
                placeholder="Agendar Agora"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Mostrar Redes Sociais</Label>
              <Switch
                checked={data.showSocialLinks || false}
                onCheckedChange={(checked) => updateData('showSocialLinks', checked)}
              />
            </div>
          </>
        )}

        {section.section_type === 'about' && (
          <>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={data.heading || ''}
                onChange={(e) => updateData('heading', e.target.value)}
                placeholder="Sobre Mim"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={data.description || ''}
                onChange={(e) => updateData('description', e.target.value)}
                placeholder="Conte sobre sua experiência..."
                rows={5}
              />
            </div>
            <div className="space-y-2">
              <Label>Anos de Experiência</Label>
              <Input
                type="number"
                value={data.yearsExperience || 0}
                onChange={(e) => updateData('yearsExperience', parseInt(e.target.value) || 0)}
              />
            </div>
          </>
        )}

        {section.section_type === 'services' && (
          <>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={data.heading || ''}
                onChange={(e) => updateData('heading', e.target.value)}
                placeholder="Meus Serviços"
              />
            </div>
            <div className="space-y-2">
              <Label>Modo de Exibição</Label>
              <Select
                value={data.displayMode || 'grid'}
                onValueChange={(value) => updateData('displayMode', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grid">Grade</SelectItem>
                  <SelectItem value="list">Lista</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Mostrar Preços</Label>
              <Switch
                checked={data.showPrices ?? true}
                onCheckedChange={(checked) => updateData('showPrices', checked)}
              />
            </div>
          </>
        )}

        {section.section_type === 'gallery' && (
          <>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={data.heading || ''}
                onChange={(e) => updateData('heading', e.target.value)}
                placeholder="Galeria de Trabalhos"
              />
            </div>

            {/* Tipo de Galeria */}
            <div className="space-y-2">
              <Label>Tipo de Galeria</Label>
              <Select
                value={data.galleryType || 'normal'}
                onValueChange={(value) => updateData('galleryType', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="before-after">Before / After</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Opções da galeria Normal */}
            {(data.galleryType || 'normal') === 'normal' && (
              <>
                <div className="space-y-2">
                  <Label>Layout</Label>
                  <Select value={data.layout || 'grid'} onValueChange={(value) => updateData('layout', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grid">Grade</SelectItem>
                      <SelectItem value="masonry">Masonry</SelectItem>
                      <SelectItem value="carousel">Carrossel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Colunas</Label>
                  <Select
                    value={String(data.columns || 3)}
                    onValueChange={(value) => updateData('columns', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2 Colunas</SelectItem>
                      <SelectItem value="3">3 Colunas</SelectItem>
                      <SelectItem value="4">4 Colunas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Opções Before / After */}
            {data.galleryType === 'before-after' && (
              <>
                <div className="space-y-2">
                  <Label>Imagem ANTES (URL)</Label>
                  <Input
                    value={data.beforeImage || ''}
                    onChange={(e) => updateData('beforeImage', e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Imagem DEPOIS (URL)</Label>
                  <Input
                    value={data.afterImage || ''}
                    onChange={(e) => updateData('afterImage', e.target.value)}
                    placeholder="https://..."
                  />
                </div>

                {/* Preview do slider */}
                {data.beforeImage && data.afterImage && (
                  <div className="space-y-2">
                    <Label>Preview</Label>
                    <BeforeAfterSlider
                      beforeImage={data.beforeImage}
                      afterImage={data.afterImage}
                      className="rounded-lg overflow-hidden"
                    />
                  </div>
                )}
              </>
            )}
          </>
        )}

        {section.section_type === 'testimonials' && (
          <>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={data.heading || ''}
                onChange={(e) => updateData('heading', e.target.value)}
                placeholder="O que dizem meus clientes"
              />
            </div>
            <div className="space-y-2">
              <Label>Modo de Exibição</Label>
              <Select
                value={data.displayMode || 'grid'}
                onValueChange={(value) => updateData('displayMode', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grid">Grade</SelectItem>
                  <SelectItem value="carousel">Carrossel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Máximo a Mostrar</Label>
              <Input
                type="number"
                value={data.maxToShow || 6}
                onChange={(e) => updateData('maxToShow', parseInt(e.target.value) || 6)}
              />
            </div>
          </>
        )}

        {section.section_type === 'contact' && (
          <>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={data.heading || ''}
                onChange={(e) => updateData('heading', e.target.value)}
                placeholder="Entre em Contato"
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Mostrar Telefone</Label>
              <Switch
                checked={data.showPhone ?? true}
                onCheckedChange={(checked) => updateData('showPhone', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Mostrar WhatsApp</Label>
              <Switch
                checked={data.showWhatsApp ?? true}
                onCheckedChange={(checked) => updateData('showWhatsApp', checked)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Mostrar Email</Label>
              <Switch
                checked={data.showEmail ?? false}
                onCheckedChange={(checked) => updateData('showEmail', checked)}
              />
            </div>
          </>
        )}

        {section.section_type === 'faq' && (
          <>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={data.heading || ''}
                onChange={(e) => updateData('heading', e.target.value)}
                placeholder="Perguntas Frequentes"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Perguntas e Respostas</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const items = [...(data.items || [])];
                    items.push({ question: '', answer: '' });
                    updateData('items', items);
                  }}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Adicionar
                </Button>
              </div>

              {(!data.items || data.items.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                  Nenhuma pergunta adicionada. Clique em "Adicionar" para começar.
                </p>
              )}

              {(data.items || []).map((item: { question: string; answer: string }, idx: number) => (
                <div key={idx} className="space-y-2 p-3 border rounded-lg relative">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      const items = [...(data.items || [])];
                      items.splice(idx, 1);
                      updateData('items', items);
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  <div className="space-y-1 pr-8">
                    <Label className="text-xs">Pergunta {idx + 1}</Label>
                    <Input
                      value={item.question}
                      onChange={(e) => {
                        const items = [...(data.items || [])];
                        items[idx] = { ...items[idx], question: e.target.value };
                        updateData('items', items);
                      }}
                      placeholder="Ex: Preciso agendar com antecedência?"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Resposta</Label>
                    <Textarea
                      value={item.answer}
                      onChange={(e) => {
                        const items = [...(data.items || [])];
                        items[idx] = { ...items[idx], answer: e.target.value };
                        updateData('items', items);
                      }}
                      placeholder="Resposta para esta pergunta..."
                      rows={2}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Tradução Automática */}
        {getTranslatableContent() && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">
              Traduzir conteúdo desta seção para EN, RO, AR, ES
            </p>
            <AutoTranslateButton
              content={getTranslatableContent()}
              onTranslated={handleTranslated}
            />
          </div>
        )}

        {/* Botões de Ação */}
        <div className="flex gap-2 pt-4">
          <Button onClick={handleSave} className="flex-1">
            <Save className="w-4 h-4 mr-2" />
            Salvar Alterações
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
