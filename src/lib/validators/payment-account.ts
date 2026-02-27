import { validateIBAN } from './iban';

/** Valida chave PIX brasileira (CPF, CNPJ, telefone, email, chave aleatória) */
function validatePIX(key: string): boolean {
  const k = key.trim();
  if (!k) return false;

  // Chave aleatória (UUID-like, 32-36 chars hex/hífen)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(k)) return true;

  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k)) return true;

  // Telefone (+55 11 99999-9999 ou 11999999999)
  const phone = k.replace(/\D/g, '');
  if (phone.length === 11 || phone.length === 13) return true;

  // CPF (11 dígitos)
  const digits = k.replace(/\D/g, '');
  if (digits.length === 11) return true;

  // CNPJ (14 dígitos)
  if (digits.length === 14) return true;

  // Dados bancários: agência/conta (mínimo 5 chars)
  return k.length >= 5;
}

/** Valida routing number + account number (US) — básico */
function validateUSAccount(account: string): boolean {
  const a = account.replace(/\s+/g, '');
  // Aceita formato "ROUTING/ACCOUNT" ou só account com 6-17 dígitos
  if (a.includes('/')) {
    const [routing, acc] = a.split('/');
    return /^\d{9}$/.test(routing.trim()) && acc.trim().length >= 6;
  }
  return /^\d{6,17}$/.test(a);
}

/** Comprimentos esperados de IBAN por país */
const IBAN_LENGTHS: Record<string, number> = {
  IE: 22, GB: 22, DE: 22, NL: 18, AT: 20, BE: 16, LU: 20,
  ES: 24, SE: 24, DK: 18, FI: 18, NO: 15, CH: 21,
  FR: 27, IT: 27, PT: 25, PL: 28,
};

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

export function validatePaymentAccount(account: string, country: string): ValidationResult {
  const trimmed = account.trim();
  if (!trimmed) return { valid: false, message: 'Campo obrigatório' };

  switch (country) {
    case 'IE':
    case 'GB':
    case 'DE':
    case 'NL':
    case 'AT':
    case 'BE':
    case 'LU':
    case 'SE':
    case 'DK':
    case 'FI':
    case 'NO':
    case 'CH':
    case 'FR':
    case 'IT':
    case 'PL': {
      const expected = IBAN_LENGTHS[country];
      const raw = trimmed.replace(/\s+/g, '').toUpperCase();
      if (!validateIBAN(raw)) {
        return { valid: false, message: `IBAN inválido. Esperado ${expected} caracteres após ${country}.` };
      }
      return { valid: true };
    }

    case 'ES': {
      const raw = trimmed.replace(/\s+/g, '').toUpperCase();
      if (!validateIBAN(raw)) {
        return { valid: false, message: 'IBAN espanhol inválido. Deve ter 24 caracteres (ES...).' };
      }
      return { valid: true };
    }

    case 'PT': {
      const raw = trimmed.replace(/\s+/g, '').toUpperCase();
      if (!validateIBAN(raw)) {
        return { valid: false, message: 'IBAN português inválido. Deve ter 25 caracteres (PT...).' };
      }
      return { valid: true };
    }

    case 'BR': {
      if (!validatePIX(trimmed)) {
        return { valid: false, message: 'Chave PIX inválida.' };
      }
      return { valid: true };
    }

    case 'US': {
      if (!validateUSAccount(trimmed)) {
        return { valid: false, message: 'Conta inválida. Use o formato: ROUTING/CONTA (ex: 021000021/12345678).' };
      }
      return { valid: true };
    }

    default:
      // Validação básica para países não mapeados
      if (trimmed.length < 5) {
        return { valid: false, message: 'Número de conta muito curto.' };
      }
      return { valid: true };
  }
}

/** Retorna o label correto do campo de conta bancária por país */
export function getAccountLabel(country: string): { label: string; placeholder: string; hint: string } {
  switch (country) {
    case 'BR':
      return {
        label: 'Chave PIX',
        placeholder: 'CPF, e-mail, telefone ou chave aleatória',
        hint: 'Ou informe agência e conta no formato AGÊNCIA/CONTA',
      };
    case 'US':
      return {
        label: 'Routing + Account Number',
        placeholder: 'Ex: 021000021/12345678',
        hint: 'Routing number (9 dígitos) / Account number',
      };
    default:
      return {
        label: 'IBAN',
        placeholder: `${country}XX XXXX XXXX XXXX XXXX XX`,
        hint: `Número de conta bancária internacional (${IBAN_LENGTHS[country] ?? 22} caracteres)`,
      };
  }
}
