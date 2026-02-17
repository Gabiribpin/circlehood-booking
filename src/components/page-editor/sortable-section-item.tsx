'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface SortableSectionItemProps {
  section: any;
  label: string;
  onToggle: (id: string) => void;
  onEdit: () => void;
}

export function SortableSectionItem({ section, label, onToggle, onEdit }: SortableSectionItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: section.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`p-3 ${isDragging ? 'shadow-lg' : ''} ${!section.is_visible ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-2">
        {/* Drag Handle */}
        <button
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-5 h-5" />
        </button>

        {/* Label */}
        <div className="flex-1 font-medium text-sm">{label}</div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onToggle(section.id)}
            title={section.is_visible ? 'Ocultar' : 'Mostrar'}
          >
            {section.is_visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={onEdit} title="Editar">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
