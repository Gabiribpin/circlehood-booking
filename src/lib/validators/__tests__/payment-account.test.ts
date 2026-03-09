import { describe, it, expect } from 'vitest';
import { validatePaymentAccount, getAccountLabel } from '../payment-account';

// ─── IBAN — Países Europeus ───────────────────────────────────────────────────

describe('validatePaymentAccount — IBAN Irlanda (IE)', () => {
  it('aceita IBAN IE válido', () => {
    expect(validatePaymentAccount('IE29AIBK93115212345678', 'IE').valid).toBe(true);
  });

  it('aceita IBAN IE com espaços', () => {
    expect(validatePaymentAccount('IE29 AIBK 9311 5212 3456 78', 'IE').valid).toBe(true);
  });

  it('rejeita IBAN IE com comprimento errado', () => {
    const result = validatePaymentAccount('IE29AIBK931152', 'IE');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('22');
  });

  it('rejeita IBAN IE com checksum inválido', () => {
    expect(validatePaymentAccount('IE29AIBK93115212345679', 'IE').valid).toBe(false);
  });
});

describe('validatePaymentAccount — IBAN Reino Unido (GB)', () => {
  it('aceita IBAN GB válido', () => {
    expect(validatePaymentAccount('GB29NWBK60161331926819', 'GB').valid).toBe(true);
  });

  it('rejeita IBAN GB inválido', () => {
    expect(validatePaymentAccount('GB00NWBK60161331926819', 'GB').valid).toBe(false);
  });
});

describe('validatePaymentAccount — IBAN Alemanha (DE)', () => {
  it('aceita IBAN DE válido', () => {
    expect(validatePaymentAccount('DE89370400440532013000', 'DE').valid).toBe(true);
  });

  it('rejeita IBAN DE inválido', () => {
    expect(validatePaymentAccount('DE00370400440532013000', 'DE').valid).toBe(false);
  });
});

describe('validatePaymentAccount — IBAN Espanha (ES)', () => {
  it('aceita IBAN ES válido', () => {
    expect(validatePaymentAccount('ES9121000418450200051332', 'ES').valid).toBe(true);
  });

  it('rejeita IBAN ES com comprimento errado', () => {
    const result = validatePaymentAccount('ES91210004184502000513', 'ES');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('ES');
  });
});

describe('validatePaymentAccount — IBAN Portugal (PT)', () => {
  it('aceita IBAN PT válido', () => {
    expect(validatePaymentAccount('PT50000201231234567890154', 'PT').valid).toBe(true);
  });

  it('rejeita IBAN PT com comprimento errado', () => {
    const result = validatePaymentAccount('PT50000201231234567890', 'PT');
    expect(result.valid).toBe(false);
    expect(result.message).toContain('PT');
  });
});

describe('validatePaymentAccount — IBAN Países Baixos (NL)', () => {
  it('aceita IBAN NL válido', () => {
    expect(validatePaymentAccount('NL91ABNA0417164300', 'NL').valid).toBe(true);
  });
});

describe('validatePaymentAccount — IBAN França (FR)', () => {
  it('aceita IBAN FR válido', () => {
    expect(validatePaymentAccount('FR7630006000011234567890189', 'FR').valid).toBe(true);
  });
});

describe('validatePaymentAccount — IBAN Itália (IT)', () => {
  it('aceita IBAN IT válido', () => {
    expect(validatePaymentAccount('IT60X0542811101000000123456', 'IT').valid).toBe(true);
  });
});

// ─── PIX — Brasil ─────────────────────────────────────────────────────────────

describe('validatePaymentAccount — PIX Brasil (BR)', () => {
  it('aceita chave email como PIX', () => {
    expect(validatePaymentAccount('usuario@gmail.com', 'BR').valid).toBe(true);
  });

  it('aceita CPF como PIX (11 dígitos)', () => {
    expect(validatePaymentAccount('12345678901', 'BR').valid).toBe(true);
  });

  it('aceita CPF formatado como PIX', () => {
    expect(validatePaymentAccount('123.456.789-01', 'BR').valid).toBe(true);
  });

  it('aceita CNPJ como PIX (14 dígitos)', () => {
    expect(validatePaymentAccount('12345678000199', 'BR').valid).toBe(true);
  });

  it('aceita telefone celular (11 dígitos) como PIX', () => {
    expect(validatePaymentAccount('11987654321', 'BR').valid).toBe(true);
  });

  it('aceita telefone com DDI +55 (13 dígitos) como PIX', () => {
    expect(validatePaymentAccount('5511987654321', 'BR').valid).toBe(true);
  });

  it('aceita chave aleatória UUID como PIX', () => {
    expect(validatePaymentAccount('123e4567-e89b-12d3-a456-426614174000', 'BR').valid).toBe(true);
  });

  it('rejeita dados bancários genéricos que não são PIX válido', () => {
    expect(validatePaymentAccount('0001/12345', 'BR').valid).toBe(false);
  });

  it('rejeita chave PIX vazia', () => {
    expect(validatePaymentAccount('', 'BR').valid).toBe(false);
  });
});

// ─── Conta US ─────────────────────────────────────────────────────────────────

describe('validatePaymentAccount — US Routing/Account', () => {
  it('aceita formato ROUTING/ACCOUNT válido', () => {
    expect(validatePaymentAccount('021000021/12345678', 'US').valid).toBe(true);
  });

  it('aceita account number simples (6-17 dígitos)', () => {
    expect(validatePaymentAccount('123456789', 'US').valid).toBe(true);
  });

  it('rejeita routing number com dígitos errados (não 9)', () => {
    expect(validatePaymentAccount('0210001/12345678', 'US').valid).toBe(false);
  });

  it('rejeita account number muito curto (<6 dígitos)', () => {
    expect(validatePaymentAccount('12345', 'US').valid).toBe(false);
  });
});

// ─── Campo vazio e país genérico ──────────────────────────────────────────────

describe('validatePaymentAccount — edge cases', () => {
  it('rejeita campo vazio para qualquer país', () => {
    expect(validatePaymentAccount('', 'IE').valid).toBe(false);
    expect(validatePaymentAccount('   ', 'IE').valid).toBe(false);
    expect(validatePaymentAccount('', 'BR').valid).toBe(false);
    expect(validatePaymentAccount('', 'US').valid).toBe(false);
  });

  it('retorna mensagem de erro descritiva', () => {
    const result = validatePaymentAccount('', 'IE');
    expect(result.message).toBeTruthy();
    expect(typeof result.message).toBe('string');
  });

  it('aceita conta genérica para país não mapeado (>=5 chars)', () => {
    expect(validatePaymentAccount('ABCDE12345', 'AU').valid).toBe(true);
  });

  it('rejeita conta genérica muito curta (<5 chars)', () => {
    expect(validatePaymentAccount('AB12', 'AU').valid).toBe(false);
  });
});

// ─── getAccountLabel ──────────────────────────────────────────────────────────

describe('getAccountLabel', () => {
  it('retorna label IBAN para países europeus', () => {
    expect(getAccountLabel('IE').label).toBe('IBAN');
    expect(getAccountLabel('GB').label).toBe('IBAN');
    expect(getAccountLabel('ES').label).toBe('IBAN');
    expect(getAccountLabel('PT').label).toBe('IBAN');
  });

  it('retorna label PIX para Brasil', () => {
    expect(getAccountLabel('BR').label).toBe('Chave PIX');
  });

  it('retorna label Routing para US', () => {
    expect(getAccountLabel('US').label).toContain('Routing');
  });

  it('inclui placeholder adequado por país', () => {
    expect(getAccountLabel('IE').placeholder).toContain('IE');
    expect(getAccountLabel('BR').placeholder).toContain('CPF');
    expect(getAccountLabel('US').placeholder).toContain('021000021');
  });
});
