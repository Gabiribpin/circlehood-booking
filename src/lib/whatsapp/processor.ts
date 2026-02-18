import { AIBot } from '@/lib/ai/chatbot';
import { WhatsAppClient } from './client';
import { createClient } from '@supabase/supabase-js';

export async function processWhatsAppMessage(
  from: string,
  text: string,
  messageId: string
) {
  try {
    // Buscar configuração do WhatsApp do usuário
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // TODO: Identificar qual usuário pelo phone number
    // Por enquanto, vamos pegar o primeiro usuário ativo
    const { data: config } = await supabase
      .from('whatsapp_config')
      .select('*')
      .eq('is_active', true)
      .single();

    if (!config) {
      console.error('No active WhatsApp config found');
      return;
    }

    // Inicializar bot e processar mensagem
    const bot = new AIBot();
    const response = await bot.processMessage(from, text, config.user_id);

    // Enviar resposta via WhatsApp
    const whatsapp = new WhatsAppClient({
      phoneNumberId: config.phone_number_id,
      accessToken: config.access_token
    });

    await whatsapp.sendMessage(from, response);
    await whatsapp.markAsRead(messageId);

  } catch (error) {
    console.error('Error processing WhatsApp message:', error);
  }
}
