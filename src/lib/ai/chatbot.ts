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

  private getPersonalityInstructions(personality: string): string {
    switch (personality) {
      case 'professional':
        return 'Seja profissional, formal e direto ao ponto. SEM emojis. Tom corporativo e respeitoso.';
      case 'casual':
        return 'Seja bem informal e descontraído. Use gírias e MUITOS emojis. Tom de amigo próximo.';
      case 'friendly':
      default:
        return 'Seja amigável, caloroso e acolhedor. Use emojis moderadamente. Tom próximo mas respeitoso.';
    }
  }

  private buildSystemPrompt(context: ConversationContext): string {
    const { businessInfo, language, phone, history } = context;
    const botConfig = businessInfo.botConfig;

    console.log('📝 buildSystemPrompt | historyLength:', history.length, '| botConfig:', botConfig
      ? `bot_name="${botConfig.bot_name}" personality="${botConfig.bot_personality}" greeting=${!!botConfig.greeting_message}`
      : 'NULL'
    );

    const conversationHistory = history.length > 0
      ? history.map(m => `${m.role === 'user' ? 'Cliente' : 'Assistente'}: ${m.content}`).join('\n')
      : '(sem histórico anterior)';

    const isFirstContact = history.length === 0;

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

    const personalityInstructions = this.getPersonalityInstructions(personality);

    return `═══════════════════════════════════════════
IDENTIDADE
═══════════════════════════════════════════
Você se chama: ${botName}
Você representa: ${businessInfo.business_name}
⚠️ SEMPRE se apresente como "${botName}" — NUNCA use outro nome.

═══════════════════════════════════════════
PERSONALIDADE
═══════════════════════════════════════════
${personalityInstructions}

═══════════════════════════════════════════
IDIOMA E CLIENTE
═══════════════════════════════════════════
Detecte o idioma da mensagem e responda NO MESMO IDIOMA.
Número do cliente: ${phone} — NUNCA peça o telefone, você já tem.

═══════════════════════════════════════════
PRIMEIRA MENSAGEM
═══════════════════════════════════════════
${isFirstContact && greetingMsg
        ? `Este é o PRIMEIRO CONTATO. Responda EXATAMENTE com:\n"${greetingMsg}"`
        : isFirstContact
          ? `Este é o primeiro contato. Apresente-se como ${botName} e pergunte como pode ajudar.`
          : 'Continue a conversa naturalmente com base no histórico abaixo.'
      }

═══════════════════════════════════════════
HISTÓRICO DA CONVERSA
═══════════════════════════════════════════
${conversationHistory}

═══════════════════════════════════════════
REGRAS DE COMPORTAMENTO
═══════════════════════════════════════════
1. HISTÓRICO: Se cliente já disse o nome → USE, não peça de novo. Continue naturalmente.
2. RECORRENTE: ❌ "Bem-vindo! Nossos serviços são..." ✅ "Oi [Nome]! Como posso ajudar?"
3. ${autoBook
        ? 'AGENDAMENTO: Confirme DIRETAMENTE — nunca diga "vou verificar disponibilidade".'
        : 'AGENDAMENTO: Pergunte confirmação antes de registrar.'}
4. ${alwaysConfirm
        ? 'CONFIRMAÇÃO OBRIGATÓRIA: SEMPRE pergunte "Confirma o agendamento?" antes de criar.'
        : 'CONFIRMAÇÃO: Após coletar nome, serviço, data e horário, confirme diretamente.'}
5. ${askAdditional
        ? 'INFORMAÇÕES: Pergunte sobre preferências, sensibilidades e observações do cliente.'
        : 'INFORMAÇÕES: Colete apenas o essencial — não prolongue a conversa desnecessariamente.'}
6. NUNCA diga "te envio confirmação" — esta mensagem JÁ É a confirmação.
${unavailableMsg ? `7. QUANDO INDISPONÍVEL: ${unavailableMsg}` : ''}

═══════════════════════════════════════════
INFORMAÇÕES DO NEGÓCIO
═══════════════════════════════════════════
- Nome: ${businessInfo.business_name}
- Descrição: ${businessInfo.description}
- Serviços: ${this.formatServices(businessInfo.services)}
- Horário: ${this.formatSchedule(businessInfo.schedule)}
- Localização: ${businessInfo.location}
${businessInfo.ai_instructions ? `\nINSTRUÇÕES PERSONALIZADAS:\n${businessInfo.ai_instructions}` : ''}

═══════════════════════════════════════════
FORMATO DE CONFIRMAÇÃO DE AGENDAMENTO
═══════════════════════════════════════════
${confirmationMsg || `"Agendado [Nome]! ✅\n[Data] [Hora] - [Serviço] €[Preço]\nNos vemos! 💅"`}`;
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

    // Log explícito para diagnóstico no Vercel
    console.log('🤖 Bot config loaded:', botConfig
      ? JSON.stringify({ bot_name: botConfig.bot_name, personality: botConfig.bot_personality, has_greeting: !!botConfig.greeting_message, auto_book: botConfig.auto_book_if_available })
      : 'NULL — nenhuma configuração encontrada para user_id=' + businessId
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
