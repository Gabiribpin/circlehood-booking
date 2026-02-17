/**
 * Phone Detection Utilities
 * Detecção automática de nacionalidade e idioma baseado no código do país
 */

interface CountryInfo {
  nationality: string;
  language: string;
  flag: string;
}

// Mapa de códigos de país para informações
const COUNTRY_CODES: Record<string, CountryInfo> = {
  '55': { nationality: 'BR', language: 'pt', flag: '🇧🇷' },    // Brasil
  '353': { nationality: 'IE', language: 'en', flag: '🇮🇪' },  // Irlanda
  '91': { nationality: 'IN', language: 'hi', flag: '🇮🇳' },   // Índia
  '54': { nationality: 'AR', language: 'es', flag: '🇦🇷' },   // Argentina
  '234': { nationality: 'NG', language: 'en', flag: '🇳🇬' },  // Nigéria
  '966': { nationality: 'SA', language: 'ar', flag: '🇸🇦' },  // Arábia Saudita
  '971': { nationality: 'AE', language: 'ar', flag: '🇦🇪' },  // Emirados Árabes
  '52': { nationality: 'MX', language: 'es', flag: '🇲🇽' },   // México
  '34': { nationality: 'ES', language: 'es', flag: '🇪🇸' },   // Espanha
  '351': { nationality: 'PT', language: 'pt', flag: '🇵🇹' },  // Portugal
  '44': { nationality: 'GB', language: 'en', flag: '🇬🇧' },   // Reino Unido
  '1': { nationality: 'US', language: 'en', flag: '🇺🇸' },    // EUA/Canadá
};

/**
 * Formata número de telefone para formato internacional
 * Remove caracteres não numéricos e adiciona +
 */
export function formatPhoneInternational(phone: string): string {
  // Remove tudo que não é número
  let cleaned = phone.replace(/\D/g, '');

  // Se não começa com código de país, assume Irlanda (+353)
  if (!phone.startsWith('+') && cleaned.length <= 10) {
    // Remove zero inicial se tiver (formato irlandês: 085 -> +353 85)
    if (cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    cleaned = '353' + cleaned;
  }

  // Adiciona + se não tiver
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }

  return cleaned;
}

/**
 * Detecta nacionalidade pelo código do país do telefone
 */
export function detectNationalityFromPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');

  // Tenta códigos de 1 a 3 dígitos
  for (let length = 3; length >= 1; length--) {
    const code = cleaned.substring(0, length);
    if (COUNTRY_CODES[code]) {
      return COUNTRY_CODES[code].nationality;
    }
  }

  // Padrão: desconhecido
  return 'XX';
}

/**
 * Detecta idioma preferido pelo código do país
 */
export function detectLanguageFromPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');

  // Tenta códigos de 1 a 3 dígitos
  for (let length = 3; length >= 1; length--) {
    const code = cleaned.substring(0, length);
    if (COUNTRY_CODES[code]) {
      return COUNTRY_CODES[code].language;
    }
  }

  // Padrão: inglês
  return 'en';
}

/**
 * Detecta bandeira (emoji) do país
 */
export function detectFlagFromPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');

  for (let length = 3; length >= 1; length--) {
    const code = cleaned.substring(0, length);
    if (COUNTRY_CODES[code]) {
      return COUNTRY_CODES[code].flag;
    }
  }

  return '🌍';
}

/**
 * Valida se número de telefone é válido
 * Básico: verifica se tem pelo menos 8 dígitos
 */
export function validatePhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 8 && cleaned.length <= 15;
}

/**
 * Detecta zona de Dublin pelo código postal
 * Formato: Dublin 1, Dublin 2, D1, D2, etc
 */
export function detectDublinZone(address: string): string | null {
  if (!address) return null;

  // Regex para capturar D1, D2, Dublin 1, Dublin 2, etc
  const regex = /(?:Dublin\s*)?D?(\d{1,2})\b/i;
  const match = address.match(regex);

  if (match && match[1]) {
    const num = parseInt(match[1]);
    if (num >= 1 && num <= 24) {
      return `D${num}`;
    }
  }

  return null;
}

/**
 * Retorna informações completas sobre o país do telefone
 */
export function getPhoneInfo(phone: string) {
  return {
    nationality: detectNationalityFromPhone(phone),
    language: detectLanguageFromPhone(phone),
    flag: detectFlagFromPhone(phone),
    formatted: formatPhoneInternational(phone),
    isValid: validatePhone(phone),
  };
}

/**
 * Lista de nacionalidades suportadas
 */
export const NATIONALITIES = [
  { code: 'BR', name: 'Brasil', flag: '🇧🇷', language: 'pt' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪', language: 'en' },
  { code: 'IN', name: 'India', flag: '🇮🇳', language: 'hi' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', language: 'es' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', language: 'en' },
  { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦', language: 'ar' },
  { code: 'AE', name: 'UAE', flag: '🇦🇪', language: 'ar' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽', language: 'es' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', language: 'es' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', language: 'pt' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', language: 'en' },
  { code: 'US', name: 'United States', flag: '🇺🇸', language: 'en' },
];

/**
 * Lista de idiomas suportados
 */
export const LANGUAGES = [
  { code: 'pt', name: 'Português', nativeName: 'Português' },
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
];

/**
 * Lista de zonas de Dublin (D1-D24)
 */
export const DUBLIN_ZONES = Array.from({ length: 24 }, (_, i) => ({
  code: `D${i + 1}`,
  name: `Dublin ${i + 1}`,
}));
