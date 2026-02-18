export type WhatsAppProvider = 'meta' | 'evolution';

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
}

export interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
  instance: string;
}

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  text?: { body: string };
  timestamp: number;
}

// Formato Meta Business
export interface MetaWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        messages?: WhatsAppMessage[];
      };
      field: string;
    }>;
  }>;
}

// Formato Evolution API
export interface EvolutionWebhookPayload {
  event: string;
  instance: string;
  data: {
    key: {
      remoteJid: string;
      fromMe: boolean;
      id: string;
    };
    message?: {
      conversation?: string;
      extendedTextMessage?: { text: string };
    };
    messageTimestamp: string;
    pushName?: string;
  };
}

export function isEvolutionPayload(body: unknown): body is EvolutionWebhookPayload {
  return (
    typeof body === 'object' &&
    body !== null &&
    'event' in body &&
    'instance' in body &&
    'data' in body
  );
}

export function isMetaPayload(body: unknown): body is MetaWebhookPayload {
  return (
    typeof body === 'object' &&
    body !== null &&
    'object' in body &&
    'entry' in body
  );
}
