import { Badge } from '@/components/ui/badge';

const STATUS_LABELS: Record<string, string> = {
  new:       'Novo',
  contacted: 'Contactado',
  qualified: 'Qualificado',
  converted: 'Convertido',
  lost:      'Perdido',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  new:       'destructive',
  contacted: 'secondary',
  qualified: 'default',
  converted: 'outline',
  lost:      'outline',
};

const STATUS_COLOR: Record<string, string> = {
  new:       '',
  contacted: '',
  qualified: 'border-blue-400 text-blue-700 dark:text-blue-300',
  converted: 'border-green-400 text-green-700 dark:text-green-300',
  lost:      'border-slate-300 text-slate-500',
};

export function LeadStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant={STATUS_VARIANT[status] ?? 'outline'}
      className={`text-xs ${STATUS_COLOR[status] ?? ''}`}
    >
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
