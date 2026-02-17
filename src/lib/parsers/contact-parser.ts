/**
 * Contact Parser
 * Parse de arquivos CSV e VCF (vCard) para importação de contatos
 */

import {
  detectNationalityFromPhone,
  detectLanguageFromPhone,
  formatPhoneInternational,
  detectDublinZone,
} from '../utils/phone-detection';

export interface ParsedContact {
  name: string;
  phone: string;
  email?: string;
  category?: string;
  notes?: string;
  nationality?: string;
  preferred_language?: string;
  dublin_zone?: string;
  address?: string;
  source: 'csv_import' | 'vcf_import' | 'manual';
}

export interface ParseResult {
  contacts: ParsedContact[];
  errors: string[];
  stats: {
    total: number;
    parsed: number;
    errors: number;
  };
}

/**
 * Parse arquivo CSV
 * Formato esperado: Nome,Telefone,Email,Categoria,Notas,Nacionalidade,Idioma,Zona,Endereço
 * Campos mínimos: Nome,Telefone
 */
export function parseCSV(csvText: string): ParseResult {
  const contacts: ParsedContact[] = [];
  const errors: string[] = [];

  // Split por linhas
  const lines = csvText.split('\n').map((line) => line.trim()).filter(Boolean);

  if (lines.length === 0) {
    return {
      contacts: [],
      errors: ['Arquivo vazio'],
      stats: { total: 0, parsed: 0, errors: 1 },
    };
  }

  // Ignora primeira linha (header)
  const dataLines = lines.slice(1);

  dataLines.forEach((line, index) => {
    try {
      // Split por vírgula (mas respeita vírgulas entre aspas)
      const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
      const cleanValues = values.map((v) => v.replace(/^"|"$/g, '').trim());

      const [
        name,
        phone,
        email,
        category,
        notes,
        nationality,
        language,
        zone,
        address,
      ] = cleanValues;

      // Validação: nome e telefone são obrigatórios
      if (!name || !phone) {
        errors.push(`Linha ${index + 2}: Nome ou telefone faltando`);
        return;
      }

      // Formata telefone
      const formattedPhone = formatPhoneInternational(phone);

      // Detecção automática se não fornecido
      const detectedNationality = nationality || detectNationalityFromPhone(formattedPhone);
      const detectedLanguage = language || detectLanguageFromPhone(formattedPhone);
      const detectedZone = zone || (address ? detectDublinZone(address) : null);

      contacts.push({
        name,
        phone: formattedPhone,
        email: email || undefined,
        category: category || undefined,
        notes: notes || undefined,
        nationality: detectedNationality,
        preferred_language: detectedLanguage,
        dublin_zone: detectedZone || undefined,
        address: address || undefined,
        source: 'csv_import',
      });
    } catch (error) {
      errors.push(`Linha ${index + 2}: Erro ao processar - ${error}`);
    }
  });

  return {
    contacts,
    errors,
    stats: {
      total: dataLines.length,
      parsed: contacts.length,
      errors: errors.length,
    },
  };
}

/**
 * Parse arquivo VCF (vCard)
 * Formato padrão vCard 3.0/4.0
 */
export function parseVCF(vcfText: string): ParseResult {
  const contacts: ParsedContact[] = [];
  const errors: string[] = [];

  // Split por vCards individuais
  const vCards = vcfText.split(/BEGIN:VCARD/i).filter(Boolean);

  vCards.forEach((vcard, index) => {
    try {
      let name = '';
      let phone = '';
      let email = '';
      let address = '';
      let note = '';

      // Parse linha por linha
      const lines = vcard.split('\n');

      lines.forEach((line) => {
        const trimmed = line.trim();

        // Nome (FN = Full Name)
        if (trimmed.startsWith('FN:')) {
          name = trimmed.substring(3).trim();
        }

        // Telefone (TEL)
        if (trimmed.includes('TEL')) {
          // Remove prefixos do vCard (TYPE, VALUE, etc)
          const phoneMatch = trimmed.match(/:([\d\s\+\-\(\)]+)$/);
          if (phoneMatch && !phone) {
            phone = phoneMatch[1].trim();
          }
        }

        // Email
        if (trimmed.includes('EMAIL')) {
          const emailMatch = trimmed.match(/:(.+@.+\..+)$/);
          if (emailMatch && !email) {
            email = emailMatch[1].trim();
          }
        }

        // Endereço
        if (trimmed.startsWith('ADR')) {
          // ADR formato: ;;street;city;state;postal;country
          const parts = trimmed.split(':')[1]?.split(';') || [];
          address = parts.filter(Boolean).join(', ').trim();
        }

        // Notas
        if (trimmed.startsWith('NOTE:')) {
          note = trimmed.substring(5).trim();
        }
      });

      // Validação
      if (!name || !phone) {
        errors.push(`vCard ${index + 1}: Nome ou telefone faltando`);
        return;
      }

      // Formata telefone
      const formattedPhone = formatPhoneInternational(phone);

      // Detecção automática
      const detectedNationality = detectNationalityFromPhone(formattedPhone);
      const detectedLanguage = detectLanguageFromPhone(formattedPhone);
      const detectedZone = address ? detectDublinZone(address) : null;

      contacts.push({
        name,
        phone: formattedPhone,
        email: email || undefined,
        notes: note || undefined,
        nationality: detectedNationality,
        preferred_language: detectedLanguage,
        dublin_zone: detectedZone || undefined,
        address: address || undefined,
        source: 'vcf_import',
      });
    } catch (error) {
      errors.push(`vCard ${index + 1}: Erro ao processar - ${error}`);
    }
  });

  return {
    contacts,
    errors,
    stats: {
      total: vCards.length,
      parsed: contacts.length,
      errors: errors.length,
    },
  };
}

/**
 * Detecta tipo de arquivo e faz parse apropriado
 */
export function parseContactFile(content: string, filename: string): ParseResult {
  const extension = filename.toLowerCase().split('.').pop();

  if (extension === 'csv') {
    return parseCSV(content);
  } else if (extension === 'vcf') {
    return parseVCF(content);
  } else {
    return {
      contacts: [],
      errors: [`Formato de arquivo não suportado: ${extension}`],
      stats: { total: 0, parsed: 0, errors: 1 },
    };
  }
}

/**
 * Gera template CSV para download
 */
export function generateCSVTemplate(): string {
  const header = 'Nome,Telefone,Email,Categoria,Notas,Nacionalidade,Idioma,Zona,Endereço';
  const examples = [
    'Maria Silva,+353851234567,maria@email.com,Unhas,Cliente VIP,BR,pt,D15,"123 Main St, Dublin 15"',
    'John Murphy,+353861234567,john@email.com,Cabelo,,IE,en,D2,"456 Oak Rd, Dublin 2"',
    'Raj Patel,+353871234567,raj@email.com,Barba,,IN,hi,D1,"789 Park Ave, Dublin 1"',
  ];

  return [header, ...examples].join('\n');
}
