import { describe, it, expect } from 'vitest';
import { validateIBAN, validateIrishIBAN, formatIBAN } from '../iban';

// IBANs válidos por país (checksum mod-97 correto)
// Fonte: exemplos oficiais de cada banco central
describe('validateIBAN — IBANs válidos', () => {
  it('aceita IBAN irlandês (IE, 22 chars)', () => {
    expect(validateIBAN('IE29AIBK93115212345678')).toBe(true);
  });

  it('aceita IBAN britânico (GB, 22 chars)', () => {
    expect(validateIBAN('GB29NWBK60161331926819')).toBe(true);
  });

  it('aceita IBAN alemão (DE, 22 chars)', () => {
    expect(validateIBAN('DE89370400440532013000')).toBe(true);
  });

  it('aceita IBAN espanhol (ES, 24 chars)', () => {
    expect(validateIBAN('ES9121000418450200051332')).toBe(true);
  });

  it('aceita IBAN português (PT, 25 chars)', () => {
    expect(validateIBAN('PT50000201231234567890154')).toBe(true);
  });

  it('aceita IBAN holandês (NL, 18 chars)', () => {
    expect(validateIBAN('NL91ABNA0417164300')).toBe(true);
  });

  it('aceita IBAN francês (FR, 27 chars)', () => {
    expect(validateIBAN('FR7630006000011234567890189')).toBe(true);
  });

  it('aceita IBAN italiano (IT, 27 chars)', () => {
    expect(validateIBAN('IT60X0542811101000000123456')).toBe(true);
  });

  it('ignora espaços — IBAN formatado com espaços deve ser aceito', () => {
    expect(validateIBAN('IE29 AIBK 9311 5212 3456 78')).toBe(true);
    expect(validateIBAN('GB29 NWBK 6016 1331 9268 19')).toBe(true);
  });

  it('aceita minúsculas — normaliza para uppercase', () => {
    expect(validateIBAN('ie29aibk93115212345678')).toBe(true);
  });
});

describe('validateIBAN — IBANs inválidos', () => {
  it('rejeita string vazia', () => {
    expect(validateIBAN('')).toBe(false);
  });

  it('rejeita string muito curta (<4 chars)', () => {
    expect(validateIBAN('IE')).toBe(false);
    expect(validateIBAN('IE2')).toBe(false);
  });

  it('rejeita comprimento errado para IE (deve ter 22)', () => {
    expect(validateIBAN('IE29AIBK931152123456')).toBe(false);   // 20 chars
    expect(validateIBAN('IE29AIBK9311521234567890')).toBe(false); // 24 chars
  });

  it('rejeita checksum incorreto', () => {
    expect(validateIBAN('IE29AIBK93115212345679')).toBe(false); // último dígito alterado
    expect(validateIBAN('GB00NWBK60161331926819')).toBe(false); // check digits 00
  });

  it('rejeita comprimento fora dos limites genéricos (<15 ou >34)', () => {
    expect(validateIBAN('XX1234567890123')).toBe(false); // 15 chars mas checksum inválido
    expect(validateIBAN('XX1234567890123456789012345678901234567')).toBe(false); // >34
  });

  it('rejeita IBAN com caracteres especiais', () => {
    expect(validateIBAN('IE29!IBK93115212345678')).toBe(false);
  });
});

describe('validateIrishIBAN', () => {
  it('aceita IBAN irlandês válido', () => {
    expect(validateIrishIBAN('IE29AIBK93115212345678')).toBe(true);
  });

  it('rejeita IBAN de outro país', () => {
    expect(validateIrishIBAN('GB29NWBK60161331926819')).toBe(false);
  });

  it('rejeita IBAN IE com comprimento errado', () => {
    expect(validateIrishIBAN('IE29AIBK931152123456')).toBe(false);
  });

  it('aceita com espaços (normaliza)', () => {
    expect(validateIrishIBAN('IE29 AIBK 9311 5212 3456 78')).toBe(true);
  });
});

describe('formatIBAN', () => {
  it('formata em grupos de 4', () => {
    expect(formatIBAN('IE29AIBK93115212345678')).toBe('IE29 AIBK 9311 5212 3456 78');
  });

  it('remove espaços antes de reformatar', () => {
    expect(formatIBAN('IE29 AIBK 93115212345678')).toBe('IE29 AIBK 9311 5212 3456 78');
  });

  it('converte para uppercase', () => {
    expect(formatIBAN('ie29aibk93115212345678')).toBe('IE29 AIBK 9311 5212 3456 78');
  });
});
