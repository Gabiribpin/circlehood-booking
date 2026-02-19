import Redis from 'ioredis';

// Singleton — reutiliza conexão entre invocações quentes do Vercel
let redis: Redis | null = null;

function getRedis(): Redis {
  if (redis) return redis;

  redis = new Redis(process.env.STORAGE_URL!, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy: (times) => {
      if (times > 3) {
        console.error('❌ Redis: falhou após 3 tentativas');
        return null;
      }
      const delay = Math.min(times * 50, 2000);
      console.log(`🔄 Redis: retry #${times} em ${delay}ms`);
      return delay;
    },
  });

  redis.on('connect', () => console.log('🔌 Redis: conectado'));
  redis.on('ready', () => console.log('✅ Redis: pronto'));
  redis.on('error', (err) => console.error('❌ Redis error:', err.message));

  return redis;
}

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
      const client = getRedis();
      const key = `conversation:${cacheKey}`;
      const dataStr = await client.get(key);

      if (!dataStr) {
        console.log('📦 Redis: nenhum histórico para', cacheKey);
        return [];
      }

      const data = JSON.parse(dataStr) as ConversationMessage[];
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
      const client = getRedis();
      const key = `conversation:${cacheKey}`;

      const current = await this.getHistory(cacheKey);
      const updated = [...current, ...messages];
      const limited = updated.slice(-MAX_MESSAGES);

      await client.setex(key, TTL, JSON.stringify(limited));

      console.log('✅ Redis: salvou', messages.length, 'mensagens |', limited.length, 'total para', cacheKey);

    } catch (error) {
      console.error('❌ Redis set error:', error);
    }
  }

  static async clear(cacheKey: string): Promise<void> {
    try {
      const client = getRedis();
      const key = `conversation:${cacheKey}`;
      await client.del(key);
      console.log('🗑️ Redis: histórico limpo para', cacheKey);
    } catch (error) {
      console.error('❌ Redis del error:', error);
    }
  }
}
