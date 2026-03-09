export const COUNTRY_CODES = [
  'IE', 'PT', 'BR', 'GB', 'US', 'ES', 'FR', 'DE', 'IT', 'AU', 'CA', 'MX', 'AR', 'CO',
] as const;

export const CURRENCY_BY_COUNTRY: Record<string, string> = {
  IE: 'eur', PT: 'eur', ES: 'eur', FR: 'eur', DE: 'eur', IT: 'eur',
  BR: 'brl', GB: 'gbp', US: 'usd', AU: 'aud', CA: 'cad', MX: 'mxn',
  AR: 'ars', CO: 'cop',
};

export const CATEGORY_KEYS = [
  'barber',
  'hairdresser',
  'coach',
  'cleaner',
  'dogGroomer',
  'esthetician',
  'physiotherapist',
  'photographer',
  'yogaInstructor',
  'makeupArtist',
  'massageTherapist',
  'nailTech',
  'nutritionist',
  'personalTrainer',
  'teacher',
  'psychologist',
  'other',
] as const;

// Backward compatibility — map old PT-BR DB values to new keys
export const LEGACY_CATEGORY_MAP: Record<string, string> = {
  'Barbeiro': 'barber',
  'Cabeleireiro(a)': 'hairdresser',
  'Coach / Consultor': 'coach',
  'Cleaner': 'cleaner',
  'Dog Groomer / Pet': 'dogGroomer',
  'Esteticista': 'esthetician',
  'Fisioterapeuta': 'physiotherapist',
  'Fotógrafo': 'photographer',
  'Instrutor de Yoga/Pilates': 'yogaInstructor',
  'Makeup Artist': 'makeupArtist',
  'Massagista': 'massageTherapist',
  'Nail Tech': 'nailTech',
  'Nutricionista': 'nutritionist',
  'Personal Trainer': 'personalTrainer',
  'Professor / Tutor': 'teacher',
  'Psicólogo / Terapeuta': 'psychologist',
  'Outro': 'other',
};

/** @deprecated Use COUNTRY_CODES + i18n instead */
export const COUNTRIES = COUNTRY_CODES.map((code) => ({ code, label: code }));

/** @deprecated Use CATEGORY_KEYS + i18n instead */
export const CATEGORIES = CATEGORY_KEYS as unknown as string[];
