export interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
  instance: string;
}

/**
 * Normaliza um número de telefone para o formato esperado pela Evolution API / WhatsApp.
 *
 * Regras:
 * 1. Remove todos os caracteres não numéricos (+, espaços, hífens, parênteses)
 * 2. Remove o 0 do prefixo nacional (trunk prefix) para países que o usam:
 *    - Irlanda (+353):  +353 083... → 35383...
 *    - UK (+44):        +44 07911... → 447911...
 *    - Brasil (+55):    +55 011... → 5511... (raro, mas possível)
 *    - Austrália (+61): +61 04... → 614...
 *    - Alemanha (+49):  +49 0... → 49...
 *    - e outros países europeus com trunk prefix 0
 *
 * Números já no formato correto (sem trunk prefix) permanecem inalterados.
 */
// Códigos de países que usam 0 como prefixo nacional (trunk prefix)
const TRUNK_PREFIX_CODES = [
  '353', // Irlanda
  '44',  // UK
  '55',  // Brasil
  '61',  // Austrália
  '49',  // Alemanha
  '33',  // França
  '39',  // Itália
  '31',  // Holanda
  '43',  // Áustria
  '41',  // Suíça
  '32',  // Bélgica
  '30',  // Grécia
  '36',  // Hungria
  '48',  // Polônia
  '420', // República Tcheca
  '421', // Eslováquia
  '45',  // Dinamarca (alguns casos)
  '46',  // Suécia
  '47',  // Noruega
];

export function normalizePhoneForWhatsApp(phone: string): string {
  // 1. Remover tudo que não for dígito
  let num = phone.replace(/[^0-9]/g, '');

  // 2. Remover trunk prefix 0 (ex.: +353 083... → 353083... → 35383...)
  for (const cc of TRUNK_PREFIX_CODES) {
    if (num.startsWith(cc + '0')) {
      num = cc + num.slice(cc.length + 1);
      break;
    }
  }

  return num;
}

export async function sendEvolutionMessage(
  phone: string,
  message: string,
  config: EvolutionConfig
): Promise<void> {
  const normalized = normalizePhoneForWhatsApp(phone);

  const url = `${config.apiUrl}/message/sendText/${config.instance}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': config.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      number: normalized,
      text: message,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Evolution API error: ${response.status} - ${error}`);
  }
}

export function parseEvolutionPhone(remoteJid: string): string {
  // "5511966179803@s.whatsapp.net" → "5511966179803"
  return remoteJid.split('@')[0];
}
