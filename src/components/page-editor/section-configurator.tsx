'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Save } from 'lucide-react';

interface SectionConfiguratorProps {
  section: any;
  onSave: (section: any) => void;
  onCancel: () => void;
}

export function SectionConfigurator({ section, onSave, onCancel }: SectionConfiguratorProps) {
  const [data, setData] = useState(section.data || {});
  const [isVisible, setIsVisible] = useState(section.is_visible);
  const [theme, setTheme] = useState(section.theme || 'default');

  const handleSave = () => {
    onSave({
      ...section,
      data,
      is_visible: isVisible,
      theme,
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

        {/* Tema */}
        <div className="space-y-2">
          <Label>Tema</Label>
          <Select value={theme} onValueChange={setTheme}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Padrão</SelectItem>
              <SelectItem value="modern">Moderno</SelectItem>
              <SelectItem value="elegant">Elegante</SelectItem>
              <SelectItem value="minimalist">Minimalista</SelectItem>
            </SelectContent>
          </Select>
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
            <p className="text-sm text-muted-foreground">
              Para adicionar perguntas, use a aba "FAQ" no menu principal
            </p>
          </>
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
