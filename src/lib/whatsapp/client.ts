import { createClient } from '@supabase/supabase-js';

interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
}

export class WhatsAppClient {
  private config: WhatsAppConfig;

  constructor(config: WhatsAppConfig) {
    this.config = config;
  }

  async sendMessage(to: string, message: string) {
    const url = `https://graph.facebook.com/v18.0/${this.config.phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: message }
      })
    });

    return response.json();
  }

  async sendTemplate(to: string, templateName: string, language: string, components?: any[]) {
    const url = `https://graph.facebook.com/v18.0/${this.config.phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: language },
          components: components || []
        }
      })
    });

    return response.json();
  }

  async markAsRead(messageId: string) {
    const url = `https://graph.facebook.com/v18.0/${this.config.phoneNumberId}/messages`;

    await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId
      })
    });
  }
}
