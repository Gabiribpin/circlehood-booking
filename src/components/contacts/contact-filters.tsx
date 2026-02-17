'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { NATIONALITIES, LANGUAGES, DUBLIN_ZONES } from '@/lib/utils/phone-detection';

interface ContactFiltersProps {
  filters: {
    search: string;
    nationality: string;
    language: string;
    zone: string;
  };
  onFilterChange: (filters: any) => void;
}

export function ContactFilters({ filters, onFilterChange }: ContactFiltersProps) {
  const updateFilter = (key: string, value: string) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFilterChange({
      search: '',
      nationality: 'all',
      language: 'all',
      zone: 'all',
    });
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Filtros</h3>
        <Button variant="outline" size="sm" onClick={clearFilters}>
          Limpar Filtros
        </Button>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>Buscar</Label>
          <Input
            placeholder="Nome ou telefone..."
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>Nacionalidade</Label>
          <Select value={filters.nationality} onValueChange={(v) => updateFilter('nationality', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {NATIONALITIES.map((n) => (
                <SelectItem key={n.code} value={n.code}>
                  {n.flag} {n.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Idioma</Label>
          <Select value={filters.language} onValueChange={(v) => updateFilter('language', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.nativeName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Zona Dublin</Label>
          <Select value={filters.zone} onValueChange={(v) => updateFilter('zone', v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {DUBLIN_ZONES.map((z) => (
                <SelectItem key={z.code} value={z.code}>
                  {z.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
