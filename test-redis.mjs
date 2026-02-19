// Testar Redis antes do deploy
// 1. Adicione .env.local com UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN
// 2. Execute: node --env-file=.env.local test-redis.mjs

import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function test() {
  const testKey = 'conversation:test_' + Date.now();

  console.log('1. Salvando mensagens...');
  const messages = [
    { role: 'user', content: 'Oi, quero agendar', timestamp: Date.now() },
    { role: 'assistant', content: 'Olá! Claro, qual serviço você deseja?', timestamp: Date.now() + 1 },
  ];
  await redis.setex(testKey, 60, messages);
  console.log('   ✅ Salvo');

  console.log('2. Carregando...');
  const loaded = await redis.get(testKey);
  console.log('   ✅ Carregado:', loaded.length, 'mensagens');
  console.log('   →', loaded[0].role, ':', loaded[0].content);

  console.log('3. Limpando...');
  await redis.del(testKey);
  console.log('   ✅ Limpo');

  console.log('\n✅ Redis funcionando! Pode fazer o deploy.');
}

test().catch(err => {
  console.error('❌ Erro:', err.message);
  console.error('   Verifique UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN no .env.local');
  process.exit(1);
});
