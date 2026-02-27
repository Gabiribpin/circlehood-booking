/**
 * Valida um IBAN.
 * Suporte completo ao formato IBAN (qualquer país, incluindo IE24 chars).
 */

// Mapa de letras → dígitos para o reorder do IBAN
function letterToDigit(ch: string): string {
  return (ch.charCodeAt(0) - 55).toString();
}

// Mod-97 em string longa (sem BigInt para compatibilidade)
function mod97(numStr: string): number {
  let remainder = 0;
  for (const ch of numStr) {
    remainder = (remainder * 10 + parseInt(ch, 10)) % 97;
  }
  return remainder;
}

export function validateIBAN(raw: string): boolean {
  // Remove espaços e converte para uppercase
  const iban = raw.replace(/\s+/g, '').toUpperCase();

  if (iban.length < 4) return false;

  // Comprimentos esperados por país (principais)
  const lengths: Record<string, number> = {
    IE: 22, GB: 22, DE: 22, FR: 27, ES: 24, PT: 25,
    NL: 18, BE: 16, AT: 20, CH: 21, IT: 27, BR: 29,
    PL: 28, SE: 24, DK: 18, NO: 15, FI: 18, LU: 20,
  };

  const country = iban.slice(0, 2);
  const expectedLength = lengths[country];

  // Se o país está na lista, verificar comprimento exato
  if (expectedLength && iban.length !== expectedLength) return false;
  // Comprimento mínimo genérico
  if (iban.length < 15 || iban.length > 34) return false;

  // Reordenar: mover os 4 primeiros caracteres para o final
  const rearranged = iban.slice(4) + iban.slice(0, 4);

  // Converter letras para dígitos
  const numStr = rearranged
    .split('')
    .map((ch) => (ch >= 'A' ? letterToDigit(ch) : ch))
    .join('');

  return mod97(numStr) === 1;
}

/** Valida especificamente IBAN irlandês (IE + 22 chars) */
export function validateIrishIBAN(raw: string): boolean {
  const iban = raw.replace(/\s+/g, '').toUpperCase();
  if (!iban.startsWith('IE')) return false;
  if (iban.length !== 22) return false;
  return validateIBAN(iban);
}

/** Formata IBAN em grupos de 4 (ex: IE29 AIBK 9311 5212 3456 78) */
export function formatIBAN(raw: string): string {
  const iban = raw.replace(/\s+/g, '').toUpperCase();
  return iban.replace(/(.{4})/g, '$1 ').trim();
}
