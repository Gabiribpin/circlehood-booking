'use client';

import { useRef, useState } from 'react';
import { DndContext, DragEndEvent, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Save, Eye, RefreshCw, LayoutTemplate } from 'lucide-react';
import { SortableSectionItem } from '@/components/page-editor/sortable-section-item';
import { SectionConfigurator } from '@/components/page-editor/section-configurator';
import { useToast } from '@/hooks/use-toast';
import { TEMPLATES_LIST } from '@/lib/page-templates/templates';

interface PageSection {
  id: string;
  section_type: string;
  order_index: number;
  data: any;
  is_visible: boolean;
  theme: string;
}

interface PageEditorProps {
  professionalId: string;
  professionalSlug: string;
  initialSections: PageSection[];
}

export function PageEditor({ professionalId, professionalSlug, initialSections }: PageEditorProps) {
  const [sections, setSections] = useState<PageSection[]>(initialSections);
  const [selectedSection, setSelectedSection] = useState<PageSection | null>(null);
  const [saving, setSaving] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const sectionsEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleAddFromTemplate = (templateKey: string) => {
    const template = TEMPLATES_LIST.find((t) => t.key === templateKey);
    if (!template) return;

    const newSection: PageSection = {
      id: `temp-${Date.now()}`,
      section_type: template.section_type,
      order_index: sections.length + 1,
      data: template.data,
      is_visible: template.is_visible,
      theme: template.theme,
    };

    setSections((prev) => [...prev, newSection]);
    setTemplatesOpen(false);

    // Scroll até a nova seção após o render
    setTimeout(() => {
      sectionsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    toast({
      title: `${template.icon} ${template.name} adicionado!`,
      description: 'Clique em "Salvar Ordem" para persistir a nova seção.',
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSections((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const newItems = arrayMove(items, oldIndex, newIndex);

        // Atualizar order_index
        return newItems.map((item, index) => ({
          ...item,
          order_index: index + 1,
        }));
      });
    }
  };

  const handleToggleVisibility = async (sectionId: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, is_visible: !s.is_visible } : s))
    );
  };

  const handleSaveOrder = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/page-sections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections }),
      });

      if (!response.ok) throw new Error('Failed to save');

      const data = await response.json();
      setSections(data.sections);

      toast({
        title: 'Sucesso!',
        description: 'Alterações salvas com sucesso',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao salvar alterações',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSection = async (updatedSection: PageSection) => {
    try {
      const response = await fetch('/api/page-sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedSection),
      });

      if (!response.ok) throw new Error('Failed to update');

      const { section } = await response.json();

      setSections((prev) => prev.map((s) => (s.id === section.id ? section : s)));
      setSelectedSection(null);

      toast({
        title: 'Sucesso!',
        description: 'Seção atualizada com sucesso',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao atualizar seção',
        variant: 'destructive',
      });
    }
  };

  const sectionLabels: Record<string, string> = {
    hero: '🎯 Hero',
    about: '👤 Sobre Mim',
    services: '✂️ Serviços',
    gallery: '🖼️ Galeria',
    testimonials: '⭐ Depoimentos',
    faq: '❓ FAQ',
    contact: '📞 Contato',
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Left Panel - Section List */}
      <div className="lg:col-span-1">
        <Card className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">Seções da Página</h3>
            <Button size="sm" variant="outline" onClick={handleSaveOrder} disabled={saving}>
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar Ordem
                </>
              )}
            </Button>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Arraste para reordenar. Clique para editar.
          </p>

          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {sections.map((section) => (
                  <SortableSectionItem
                    key={section.id}
                    section={section}
                    label={sectionLabels[section.section_type] || section.section_type}
                    onToggle={handleToggleVisibility}
                    onEdit={() => setSelectedSection(section)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Marcador para scroll até nova seção */}
          <div ref={sectionsEndRef} />

          <div className="mt-4 pt-4 border-t space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setTemplatesOpen(true)}
            >
              <LayoutTemplate className="w-4 h-4 mr-2" />
              Templates Prontos
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open(`/${professionalSlug}`, '_blank')}
            >
              <Eye className="w-4 h-4 mr-2" />
              Visualizar Página
            </Button>
          </div>
        </Card>
      </div>

      {/* Dialog de Templates */}
      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Seção por Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {TEMPLATES_LIST.map((template) => (
              <button
                key={template.key}
                onClick={() => handleAddFromTemplate(template.key)}
                className="w-full flex items-start gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors text-left"
              >
                <span className="text-3xl">{template.icon}</span>
                <div>
                  <p className="font-medium">{template.name}</p>
                  <p className="text-sm text-muted-foreground">{template.description}</p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Right Panel - Section Configurator */}
      <div className="lg:col-span-2">
        {selectedSection ? (
          <SectionConfigurator
            section={selectedSection}
            onSave={handleUpdateSection}
            onCancel={() => setSelectedSection(null)}
          />
        ) : (
          <Card className="p-8 text-center">
            <div className="text-muted-foreground">
              <p className="text-lg mb-2">Selecione uma seção para editar</p>
              <p className="text-sm">
                Clique em qualquer seção na lista à esquerda para começar a personalizar
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
