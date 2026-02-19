import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { detectLanguage } from './language-detector';
import { classifyIntent } from './intent-classifier';

interface ConversationContext {
  userId: string;
  phone: string;
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
    // 1. Buscar contexto do usuário
    const context = await this.getConversationContext(phone, businessId);

    // 2. Detectar idioma se ainda não foi detectado, e persistir
    if (!context.language) {
      context.language = await detectLanguage(message);
      await this.supabase
        .from('whatsapp_conversations')
        .update({ language: context.language })
        .eq('user_id', businessId)
        .eq('customer_phone', phone);
    }

    // 3. Classificar intenção
    const intent = await classifyIntent(message, context.language);

    // 4. Gerar resposta baseada na intenção
    const response = await this.generateResponse(message, intent, context);

    // 5. Salvar no histórico
    await this.saveToHistory(phone, businessId, message, response);

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
    const { businessInfo, language, phone } = context;

    return `Você é um assistente virtual amigável e prestativo para ${businessInfo.business_name}.

IDIOMA: Detecte o idioma da mensagem do cliente e responda NO MESMO IDIOMA.

NÚMERO DO CLIENTE: ${phone}
⚠️ NUNCA peça o telefone ao cliente — você já tem o número automaticamente: ${phone}

INFORMAÇÕES DO NEGÓCIO:
- Nome: ${businessInfo.business_name}
- Descrição: ${businessInfo.description}
- Serviços: ${this.formatServices(businessInfo.services)}
- Horário: ${this.formatSchedule(businessInfo.schedule)}
- Localização: ${businessInfo.location}

INSTRUÇÕES:
${businessInfo.ai_instructions || `
- Seja educado e use emojis apropriados 😊
- Responda perguntas sobre serviços e preços
- Ajude com agendamentos
- Seja proativo em oferecer ajuda
- Se não souber algo, seja honesto e ofereça alternativas
`}

CAPACIDADES:
- Responder perguntas sobre serviços
- Mostrar preços
- Verificar disponibilidade
- Fazer agendamentos
- Adicionar à lista de espera

FORMATO DE AGENDAMENTO:
Quando o cliente quiser agendar, colete:
1. Nome completo
2. Serviço desejado
3. Data e horário preferido

Depois confirme todos os detalhes antes de finalizar. (O telefone já está registrado automaticamente.)`;
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
      return { userId: phone, phone, language: '', history: [], businessInfo: {} };
    }

    // 2. Buscar últimas 10 mensagens (mais antigas primeiro para contexto)
    const { data: messages } = await this.supabase
      .from('whatsapp_messages')
      .select('direction, content')
      .eq('conversation_id', conversation.id)
      .order('sent_at', { ascending: false })
      .limit(10);

    const history: Array<{ role: 'user' | 'assistant'; content: string }> = (
      messages ?? []
    )
      .reverse()
      .map((m) => ({
        role: m.direction === 'inbound' ? 'user' : 'assistant',
        content: m.content,
      }));

    // 3. Buscar info do negócio (professional + services + working_hours)
    const { data: professional } = await this.supabase
      .from('professionals')
      .select('id, business_name, bio, city')
      .eq('user_id', businessId)
      .single();

    const { data: services } = await this.supabase
      .from('services')
      .select('name, price, duration_minutes')
      .eq('professional_id', professional?.id ?? '')
      .eq('is_active', true);

    const { data: workingHours } = await this.supabase
      .from('working_hours')
      .select('day_of_week, start_time, end_time')
      .eq('professional_id', professional?.id ?? '')
      .eq('is_available', true);

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
      language: conversation.language ?? '',
      history,
      businessInfo: {
        business_name: professional?.business_name ?? '',
        description: professional?.bio ?? '',
        services: services ?? [],
        schedule,
        location: professional?.city ?? '',
      },
    };
  }

  private async saveToHistory(
    phone: string,
    businessId: string,
    userMessage: string,
    botResponse: string
  ) {
    // 1. Buscar ID da conversa (já deve existir após getConversationContext)
    const { data: conversation, error: convError } = await this.supabase
      .from('whatsapp_conversations')
      .select('id')
      .eq('user_id', businessId)
      .eq('customer_phone', phone)
      .single();

    if (convError || !conversation) {
      console.error('saveToHistory: conversation not found', convError);
      return;
    }

    const now = new Date().toISOString();

    // 2. Inserir mensagem do cliente (inbound) e resposta do bot (outbound)
    const { error: msgError } = await this.supabase
      .from('whatsapp_messages')
      .insert([
        {
          conversation_id: conversation.id,
          direction: 'inbound',
          content: userMessage,
          status: 'received',
          sent_at: now,
        },
        {
          conversation_id: conversation.id,
          direction: 'outbound',
          content: botResponse,
          status: 'sent',
          sent_at: now,
        },
      ]);

    if (msgError) {
      console.error('saveToHistory: error inserting messages', msgError);
      return;
    }

    // 3. Atualizar last_message_at na conversa
    await this.supabase
      .from('whatsapp_conversations')
      .update({ last_message_at: now })
      .eq('id', conversation.id);
  }
}
