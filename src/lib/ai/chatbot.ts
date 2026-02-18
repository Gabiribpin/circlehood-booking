import Anthropic from '@anthropic-ai/sdk';
import { detectLanguage } from './language-detector';
import { classifyIntent } from './intent-classifier';

interface ConversationContext {
  userId: string;
  language: string;
  history: Array<{ role: 'user' | 'assistant', content: string }>;
  businessInfo: any;
}

export class AIBot {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!
    });
  }

  async processMessage(phone: string, message: string, businessId: string) {
    // 1. Buscar contexto do usuário
    const context = await this.getConversationContext(phone, businessId);

    // 2. Detectar idioma se ainda não foi detectado
    if (!context.language) {
      context.language = await detectLanguage(message);
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
    const { businessInfo, language } = context;

    return `Você é um assistente virtual amigável e prestativo para ${businessInfo.business_name}.

IDIOMA: Responda SEMPRE em ${this.getLanguageName(language)}.

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
4. Telefone (se ainda não tiver)

Depois confirme todos os detalhes antes de finalizar.`;
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
    // Buscar do banco de dados
    // Por enquanto, retornar mock
    return {
      userId: phone,
      language: '',
      history: [],
      businessInfo: {}
    };
  }

  private async saveToHistory(
    phone: string,
    businessId: string,
    userMessage: string,
    botResponse: string
  ) {
    // Salvar no banco de dados
  }
}
