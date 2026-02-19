import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

const TTL = 86400; // 24 horas
const MAX_MESSAGES = 20;

export class ConversationCache {

  static async getHistory(cacheKey: string): Promise<ConversationMessage[]> {
    try {
      const key = `conversation:${cacheKey}`;
      const data = await redis.get<ConversationMessage[]>(key);

      if (!data) {
        console.log('📦 Redis: nenhum histórico para', cacheKey);
        return [];
      }

      console.log('📦 Redis: carregou', data.length, 'mensagens para', cacheKey);
      return data;

    } catch (error) {
      console.error('❌ Redis get error:', error);
      return [];
    }
  }

  static async addMessages(
    cacheKey: string,
    messages: ConversationMessage[]
  ): Promise<void> {
    try {
      const key = `conversation:${cacheKey}`;

      const current = await this.getHistory(cacheKey);
      const updated = [...current, ...messages];
      const limited = updated.slice(-MAX_MESSAGES);

      await redis.setex(key, TTL, limited);

      console.log('✅ Redis: salvou', messages.length, 'mensagens |', limited.length, 'total para', cacheKey);

    } catch (error) {
      console.error('❌ Redis set error:', error);
    }
  }

  static async clear(cacheKey: string): Promise<void> {
    try {
      const key = `conversation:${cacheKey}`;
      await redis.del(key);
      console.log('🗑️ Redis: histórico limpo para', cacheKey);
    } catch (error) {
      console.error('❌ Redis del error:', error);
    }
  }
}
