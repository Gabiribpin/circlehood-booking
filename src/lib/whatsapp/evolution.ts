export interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
  instance: string;
}

export async function sendEvolutionMessage(
  phone: string,
  message: string,
  config: EvolutionConfig
): Promise<void> {
  // Normalizar número: remover +, espaços, traços
  const normalized = phone.replace(/[^0-9]/g, '');

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
