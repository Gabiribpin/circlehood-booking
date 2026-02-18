export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
}

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  timestamp: number;
}

export interface WhatsAppWebhookPayload {
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
