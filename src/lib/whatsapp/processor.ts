import { AIBot } from '@/lib/ai/chatbot';
import { WhatsAppClient } from './client';
import { sendEvolutionMessage } from './evolution';
import { createClient } from '@supabase/supabase-js';
import type { WhatsAppProvider } from './types';

export async function processWhatsAppMessage(
  from: string,
  text: string,
  messageId: string,
  detectedProvider?: WhatsAppProvider,
  evolutionInstance?: string
) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Buscar config ativa — se vier da Evolution, filtrar pela instância
    let query = supabase
      .from('whatsapp_config')
      .select('*')
      .eq('is_active', true);

    if (detectedProvider === 'evolution' && evolutionInstance) {
      query = query.eq('evolution_instance', evolutionInstance);
    }

    const { data: config } = await query.single();

    if (!config) {
      console.error('No active WhatsApp config found');
      return;
    }

    const provider: WhatsAppProvider = config.provider ?? detectedProvider ?? 'meta';

    // Processar mensagem com IA
    const bot = new AIBot();
    const response = await bot.processMessage(from, text, config.user_id);

    // Enviar resposta pelo provider correto
    if (provider === 'evolution') {
      await sendEvolutionMessage(from, response, {
        apiUrl: config.evolution_api_url,
        apiKey: config.evolution_api_key,
        instance: config.evolution_instance,
      });
    } else {
      const whatsapp = new WhatsAppClient({
        phoneNumberId: config.phone_number_id,
        accessToken: config.access_token,
      });
      await whatsapp.sendMessage(from, response);
      await whatsapp.markAsRead(messageId);
    }
  } catch (error) {
    console.error('Error processing WhatsApp message:', error);
  }
}
