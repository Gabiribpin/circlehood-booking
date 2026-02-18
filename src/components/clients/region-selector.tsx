'use client';

import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

const DUBLIN_REGIONS = [
  'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D6W',
  'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13',
  'D14', 'D15', 'D16', 'D17', 'D18', 'D20', 'D22', 'D24',
];

interface RegionSelectorProps {
  value: string[];
  onChange: (regions: string[]) => void;
  label?: string;
}

export function RegionSelector({
  value,
  onChange,
  label = 'Regiões do cliente',
}: RegionSelectorProps) {
  function toggle(region: string) {
    if (value.includes(region)) {
      onChange(value.filter((r) => r !== region));
    } else {
      onChange([...value, region]);
    }
  }

  function removeRegion(region: string) {
    onChange(value.filter((r) => r !== region));
  }

  function clearAll() {
    onChange([]);
  }

  return (
    <div className="space-y-3">
      {/* Label + clear */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Onde este cliente mora ou trabalha?
          </p>
        </div>
        {value.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            Limpar tudo
          </button>
        )}
      </div>

      {/* Region grid */}
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {DUBLIN_REGIONS.map((region) => {
          const selected = value.includes(region);
          return (
            <button
              key={region}
              type="button"
              onClick={() => toggle(region)}
              className={`
                px-2 py-2 rounded-lg text-sm font-semibold transition-all
                focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
                ${selected
                  ? 'bg-blue-600 text-white border-2 border-blue-700 shadow-sm scale-105'
                  : 'bg-muted text-muted-foreground border-2 border-transparent hover:bg-muted/80 hover:text-foreground'
                }
              `}
            >
              {region}
            </button>
          );
        })}
      </div>

      {/* Selected chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {value.map((region) => (
            <Badge
              key={region}
              variant="secondary"
              className="gap-1 pl-2 pr-1 py-0.5 bg-blue-100 text-blue-800 hover:bg-blue-200"
            >
              {region}
              <button
                type="button"
                onClick={() => removeRegion(region)}
                className="ml-0.5 rounded-full hover:bg-blue-300 p-0.5 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <span className="text-xs text-muted-foreground self-center">
            {value.length} região{value.length !== 1 ? 's' : ''} selecionada{value.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
