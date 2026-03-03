import { AIBot } from '@/lib/ai/chatbot';
import { WhatsAppClient } from './client';
import { sendEvolutionMessage } from './evolution';
import { createClient } from '@supabase/supabase-js';
import { ConversationCache } from '@/lib/redis/conversation-cache';
import { WhatsAppRateLimiter } from './rate-limiter';
import type { WhatsAppProvider } from './types';

export async function processWhatsAppMessage(
  from: string,
  text: string,
  messageId: string,
  detectedProvider?: WhatsAppProvider,
  evolutionInstance?: string
) {
  try {
    // Deduplicação por messageId — evita processar retries do Evolution/Meta
    if (messageId) {
      const isDuplicate = !(await ConversationCache.acquireGreetingLock(`msg:${messageId}`));
      if (isDuplicate) {
        console.log(`⚡ Mensagem duplicada ignorada: ${messageId}`);
        return;
      }
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Buscar config — filtra sempre por is_active=true
    // Evolution também filtra por instância para identificar o profissional
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

    // Verificar use_bot do contato
    const { data: professional } = await supabase
      .from('professionals')
      .select('id')
      .eq('user_id', config.user_id)
      .single();

    if (professional) {
      const normalizedPhone = from.replace(/[^0-9]/g, '');
      const { data: contact } = await supabase
        .from('contacts')
        .select('use_bot')
        .eq('professional_id', professional.id)
        .or(`phone.eq.${from},phone.eq.+${normalizedPhone},phone.eq.${normalizedPhone}`)
        .maybeSingle();

      if (contact && contact.use_bot === false) {
        console.log('🚫 Bot desativado para contato:', from);
        return;
      }
    }

    // Rate limit por telefone — proteção contra DoS no Claude API
    const rateCheck = WhatsAppRateLimiter.check(from);
    if (!rateCheck.allowed) {
      console.warn(`🚦 Rate limit atingido para ${from}: ${rateCheck.reason}`);
      return;
    }

    // Processar mensagem com IA
    const bot = new AIBot();
    const response = await bot.processMessage(from, text, config.user_id);

    // Incrementar contador após processamento bem-sucedido
    WhatsAppRateLimiter.increment(from);

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
