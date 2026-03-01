export const COUNTRIES: { code: string; label: string }[] = [
  { code: 'IE', label: 'Irlanda' },
  { code: 'PT', label: 'Portugal' },
  { code: 'BR', label: 'Brasil' },
  { code: 'GB', label: 'Reino Unido' },
  { code: 'US', label: 'Estados Unidos' },
  { code: 'ES', label: 'Espanha' },
  { code: 'FR', label: 'França' },
  { code: 'DE', label: 'Alemanha' },
  { code: 'IT', label: 'Itália' },
  { code: 'AU', label: 'Austrália' },
  { code: 'CA', label: 'Canadá' },
  { code: 'MX', label: 'México' },
  { code: 'AR', label: 'Argentina' },
  { code: 'CO', label: 'Colômbia' },
];

export const CURRENCY_BY_COUNTRY: Record<string, string> = {
  IE: 'eur', PT: 'eur', ES: 'eur', FR: 'eur', DE: 'eur', IT: 'eur',
  BR: 'brl', GB: 'gbp', US: 'usd', AU: 'aud', CA: 'cad', MX: 'mxn',
  AR: 'ars', CO: 'cop',
};

export const CATEGORIES = [
  'Barbeiro',
  'Cabeleireiro(a)',
  'Coach / Consultor',
  'Cleaner',
  'Dog Groomer / Pet',
  'Esteticista',
  'Fisioterapeuta',
  'Fotógrafo',
  'Instrutor de Yoga/Pilates',
  'Makeup Artist',
  'Massagista',
  'Nail Tech',
  'Nutricionista',
  'Personal Trainer',
  'Professor / Tutor',
  'Psicólogo / Terapeuta',
  'Outro',
];
