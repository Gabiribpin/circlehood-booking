import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { detectLanguage } from './language-detector';
import { classifyIntent } from './intent-classifier';

// Cache em memória — funciona enquanto a mesma instância Vercel estiver quente
// Complementa o banco: se DB falhar, cache garante contexto na mesma sessão
const conversationCache = new Map<string, Array<{
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}>>();

interface ConversationContext {
  userId: string;
  phone: string;
  conversationId: string;
  language: string;
  history: Array<{ role: 'user' | 'assistant', content: string }>;
  businessInfo: any;
}

export class AIBot {
  private anthropic: Anthropic;
  private supabase;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!
    });
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  async processMessage(phone: string, message: string, businessId: string) {
    // 1. Buscar contexto do banco
    const context = await this.getConversationContext(phone, businessId);

    // 2. Usar idioma salvo ou 'pt' como padrão
    if (!context.language) {
      context.language = 'pt';
    }

    // 3. Complementar histórico com cache em memória (se banco retornou vazio)
    const cacheKey = `${businessId}-${phone}`;
    let cached = (conversationCache.get(cacheKey) || [])
      .filter(m => Date.now() - m.timestamp < 24 * 60 * 60 * 1000);

    if (context.history.length === 0 && cached.length > 0) {
      console.log('📦 Usando cache em memória:', cached.length, 'mensagens');
      context.history = cached.map(m => ({ role: m.role, content: m.content }));
    }

    // 4. Adicionar mensagem atual ao cache
    cached.push({ role: 'user', content: message, timestamp: Date.now() });

    // 5. Classificar intenção
    const intent = await classifyIntent(message, context.language);

    // 6. Gerar resposta
    console.log('🤖 Chamando Anthropic para', phone, '| intent:', intent, '| history:', context.history.length);
    const response = await this.generateResponse(message, intent, context);
    console.log('✅ Anthropic respondeu para', phone);

    // 7. Salvar resposta no cache
    cached.push({ role: 'assistant', content: response, timestamp: Date.now() + 1 });
    conversationCache.set(cacheKey, cached);
    console.log('📦 Cache atualizado:', cached.length, 'mensagens para', cacheKey);

    // 8. Salvar no banco (await para garantir persistência em Vercel serverless)
    try {
      await this.saveToHistory(context.conversationId, message, response);
    } catch (err) {
      console.error('❌ saveToHistory falhou (não bloqueia resposta):', err);
    }

    return response;
  }

  private async generateResponse(
    message: string,
    intent: string,
    context: ConversationContext
  ): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(context);

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        ...context.history,
        { role: 'user', content: message }
      ]
    });

    return response.content[0].type === 'text'
      ? response.content[0].text
      : '';
  }

  private buildSystemPrompt(context: ConversationContext): string {
    const { businessInfo, language, phone, history } = context;
    const botConfig = businessInfo.botConfig;

    console.log('📝 Contexto sendo passado:', {
      phone,
      language,
      historyLength: history.length,
      historyPreview: history.slice(0, 2),
      botConfig: botConfig ? { bot_name: botConfig.bot_name, personality: botConfig.bot_personality } : null,
    });

    const conversationHistory = history.length > 0
      ? history.map(m => `${m.role === 'user' ? 'Cliente' : 'Assistente'}: ${m.content}`).join('\n')
      : '(sem histórico anterior)';

    // Variáveis disponíveis para substituição no prompt customizado
    const vars: Record<string, string> = {
      '{business_name}': businessInfo.business_name,
      '{bot_name}': botConfig?.bot_name ?? businessInfo.business_name,
      '{phone}': phone,
      '{services}': this.formatServices(businessInfo.services),
      '{schedule}': this.formatSchedule(businessInfo.schedule),
      '{location}': businessInfo.location,
      '{conversation_history}': conversationHistory,
    };

    // Se custom_system_prompt preenchido → usar diretamente com substituição de variáveis
    if (botConfig?.custom_system_prompt) {
      let prompt = botConfig.custom_system_prompt;
      for (const [key, value] of Object.entries(vars)) {
        prompt = prompt.split(key).join(value);
      }
      return prompt;
    }

    // Construir prompt padrão usando configurações do botConfig
    const botName = botConfig?.bot_name || businessInfo.business_name;
    const personality = botConfig?.bot_personality ?? 'friendly';
    const greetingMsg = botConfig?.greeting_message ?? '';
    const unavailableMsg = botConfig?.unavailable_message ?? '';
    const confirmationMsg = botConfig?.confirmation_message ?? '';
    const autoBook = botConfig?.auto_book_if_available ?? true;
    const alwaysConfirm = botConfig?.always_confirm_booking ?? false;
    const askAdditional = botConfig?.ask_for_additional_info ?? false;

    const personalityMap: Record<string, string> = {
      friendly: 'Tom: amigável e caloroso — use emojis moderadamente.',
      professional: 'Tom: profissional e formal — evite emojis.',
      casual: 'Tom: descontraído e informal — use emojis livremente.',
    };
    const personalityText = personalityMap[personality] ?? 'Tom: amigável e caloroso.';

    return `Você é ${botName}, assistente virtual de ${businessInfo.business_name}.
${personalityText}

IDIOMA: Detecte o idioma da mensagem e responda NO MESMO IDIOMA.

NÚMERO DO CLIENTE: ${phone}
⚠️ NUNCA peça o telefone — você já tem: ${phone}

═══════════════════════════════════════════
HISTÓRICO DA CONVERSA:
${conversationHistory}
═══════════════════════════════════════════

REGRAS DE COMPORTAMENTO INTELIGENTE:

1. USE O HISTÓRICO OBRIGATORIAMENTE:
   - Cliente já disse o nome? → USE o nome, não peça de novo
   - Cliente já tem agendamento? → MENCIONE ao cumprimentar
   - Cliente já conhece serviços? → NÃO liste tudo de novo
   - Continue a conversa naturalmente, nunca recomece do zero

2. RECONHEÇA CLIENTE RECORRENTE:
   ❌ ERRADO: "Bem-vindo! Nossos serviços são..."
   ✅ CORRETO: "Oi [Nome]! Tudo bem? Posso ajudar com algo?"

3. ${autoBook
      ? 'AGENDAMENTO DIRETO — confirme sem dizer "verificar disponibilidade".'
      : 'AGENDAMENTO — pergunte confirmação antes de registrar.'}

4. ${alwaysConfirm
      ? 'Sempre peça confirmação explícita do cliente antes de registrar.'
      : 'Confirme o agendamento diretamente após coletar nome, serviço, data e horário.'}

5. ${askAdditional
      ? 'Pergunte informações adicionais relevantes (ex: tipo de cabelo, sensibilidade).'
      : 'Seja direto — não peça informações desnecessárias.'}

6. NUNCA diga "te envio confirmação" — esta mensagem JÁ É a confirmação.
${greetingMsg ? `\nMENSAGEM DE BOAS-VINDAS:\n${greetingMsg}\n` : ''}${unavailableMsg ? `\nQUANDO INDISPONÍVEL:\n${unavailableMsg}\n` : ''}
INFORMAÇÕES DO NEGÓCIO:
- Nome: ${businessInfo.business_name}
- Descrição: ${businessInfo.description}
- Serviços: ${this.formatServices(businessInfo.services)}
- Horário: ${this.formatSchedule(businessInfo.schedule)}
- Localização: ${businessInfo.location}

${businessInfo.ai_instructions ? `INSTRUÇÕES PERSONALIZADAS:\n${businessInfo.ai_instructions}\n` : ''}
FORMATO DE AGENDAMENTO:
Colete: nome completo, serviço, data e horário.
${confirmationMsg || `Confirme com:\n"Agendado [Nome]! ✅\n[Data] [Hora] - [Serviço] €[Preço]\nNos vemos! 💅"`}`;
  }

  private getLanguageName(code: string): string {
    const languages: Record<string, string> = {
      'pt': 'português brasileiro',
      'en': 'English',
      'ro': 'română',
      'ar': 'العربية',
      'es': 'español'
    };
    return languages[code] || 'English';
  }

  private formatServices(services: any[]): string {
    return services.map(s =>
      `- ${s.name}: €${s.price}${s.duration ? ` (${s.duration}min)` : ''}`
    ).join('\n');
  }

  private formatSchedule(schedule: any): string {
    // Formatar horário de funcionamento
    return Object.entries(schedule)
      .map(([day, hours]: [string, any]) =>
        `${day}: ${hours.start} - ${hours.end}`
      )
      .join('\n');
  }

  private async getConversationContext(
    phone: string,
    businessId: string
  ): Promise<ConversationContext> {
    // 1. Buscar ou criar conversa
    const { data: conversation, error: convError } = await this.supabase
      .from('whatsapp_conversations')
      .upsert(
        { user_id: businessId, customer_phone: phone },
        { onConflict: 'user_id,customer_phone', ignoreDuplicates: false }
      )
      .select('id, language')
      .single();

    if (convError || !conversation) {
      console.error('Error fetching/creating conversation:', convError);
      return { userId: phone, phone, conversationId: '', language: '', history: [], businessInfo: {} };
    }

    // 2. Buscar últimas 10 mensagens (mais antigas primeiro para contexto)
    console.log('🔍 DEBUG: Buscando histórico para', phone, '| conversa:', conversation.id);
    const { data: messages } = await this.supabase
      .from('whatsapp_messages')
      .select('direction, content')
      .eq('conversation_id', conversation.id)
      .order('sent_at', { ascending: false })
      .limit(10);

    console.log('📊 Mensagens encontradas:', messages?.length ?? 0);
    if (messages && messages.length > 0) {
      console.log('💬 Últimas mensagens:', messages.map(m => `${m.direction}: ${m.content.substring(0, 50)}`));
    }

    const history: Array<{ role: 'user' | 'assistant'; content: string }> = (
      messages ?? []
    )
      .reverse()
      .map((m) => ({
        role: m.direction === 'inbound' ? 'user' : 'assistant',
        content: m.content,
      }));

    // 3. Buscar info do negócio (professional + services + working_hours + botConfig + ai_instructions)
    const [
      { data: professional },
      { data: botConfig },
      { data: aiInstructions },
    ] = await Promise.all([
      this.supabase
        .from('professionals')
        .select('id, business_name, bio, city')
        .eq('user_id', businessId)
        .single(),
      this.supabase
        .from('bot_config')
        .select('*')
        .eq('user_id', businessId)
        .maybeSingle(),
      this.supabase
        .from('ai_instructions')
        .select('instructions')
        .eq('user_id', businessId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const [{ data: services }, { data: workingHours }] = await Promise.all([
      this.supabase
        .from('services')
        .select('name, price, duration_minutes')
        .eq('professional_id', professional?.id ?? '')
        .eq('is_active', true),
      this.supabase
        .from('working_hours')
        .select('day_of_week, start_time, end_time')
        .eq('professional_id', professional?.id ?? '')
        .eq('is_available', true),
    ]);

    const schedule = (workingHours ?? []).reduce(
      (acc: Record<string, { start: string; end: string }>, wh) => {
        acc[wh.day_of_week] = { start: wh.start_time, end: wh.end_time };
        return acc;
      },
      {}
    );

    return {
      userId: phone,
      phone,
      conversationId: conversation.id,
      language: conversation.language ?? '',
      history,
      businessInfo: {
        business_name: professional?.business_name ?? '',
        description: professional?.bio ?? '',
        services: services ?? [],
        schedule,
        location: professional?.city ?? '',
        ai_instructions: aiInstructions?.instructions ?? '',
        botConfig: botConfig ?? null,
      },
    };
  }

  private async saveToHistory(
    conversationId: string,
    userMessage: string,
    botResponse: string
  ) {
    console.log('💾 saveToHistory iniciado | conversationId:', conversationId);
    if (!conversationId) {
      console.error('saveToHistory: conversationId vazio, abortando');
      return;
    }

    const now = new Date().toISOString();
    const twoMsLater = new Date(Date.now() + 2).toISOString();

    // Inserir mensagem do cliente (inbound) e resposta do bot (outbound)
    const { error: msgError } = await this.supabase
      .from('whatsapp_messages')
      .insert([
        {
          conversation_id: conversationId,
          direction: 'inbound',
          content: userMessage,
          status: 'received',
          sent_at: now,
        },
        {
          conversation_id: conversationId,
          direction: 'outbound',
          content: botResponse,
          status: 'sent',
          sent_at: twoMsLater,
        },
      ]);

    if (msgError) {
      console.error('saveToHistory: error inserting messages', msgError);
      return;
    }

    console.log('✅ saveToHistory: mensagens salvas para conversa', conversationId);

    await this.supabase
      .from('whatsapp_conversations')
      .update({ last_message_at: twoMsLater })
      .eq('id', conversationId);
  }
}
