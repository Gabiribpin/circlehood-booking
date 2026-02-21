import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { TEST } from './config';

const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);

/**
 * Limpa todo o estado de teste do Salão da Rita (4 camadas).
 * Equivalente ao comando "Limpa histórico do Salão da Rita".
 */
export async function cleanTestState() {
  // 1. Cancelar agendamentos de teste
  await supabase
    .from('bookings')
    .update({ status: 'cancelled', cancelled_by: 'system', cancellation_reason: 'E2E test cleanup' })
    .eq('professional_id', TEST.PROFESSIONAL_ID)
    .eq('client_phone', TEST.PHONE)
    .neq('status', 'cancelled');

  // 2. Limpar conversa e mensagens (Supabase — Tier 2)
  const { data: conv } = await supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('user_id', TEST.USER_ID)
    .eq('customer_phone', TEST.PHONE)
    .maybeSingle();

  if (conv) {
    await supabase.from('whatsapp_messages').delete().eq('conversation_id', conv.id);
    await supabase.from('whatsapp_conversations').delete().eq('id', conv.id);
  }

  // 3. Limpar Redis (Tier 1)
  if (TEST.REDIS_URL) {
    const redis = new Redis(TEST.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 3000 });
    await redis.del(`conversation:${TEST.USER_ID}_${TEST.PHONE}`);
    redis.disconnect();
  }

  // 4. Limpar in-memory Vercel (Tier 3)
  await fetch(`${TEST.BASE_URL}/api/admin/clear-bot-cache`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-secret': TEST.CRON_SECRET },
    body: JSON.stringify({ business_id: TEST.USER_ID, phone: TEST.PHONE }),
  });
}

/**
 * Busca a última mensagem enviada pelo bot para o número de teste.
 */
export async function getLastBotMessage(): Promise<string | null> {
  const { data: conv } = await supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('user_id', TEST.USER_ID)
    .eq('customer_phone', TEST.PHONE)
    .maybeSingle();

  if (!conv) return null;

  const { data: messages } = await supabase
    .from('whatsapp_messages')
    .select('content, direction, sent_at')
    .eq('conversation_id', conv.id)
    .eq('direction', 'outbound')
    .order('sent_at', { ascending: false })
    .limit(1);

  return messages?.[0]?.content ?? null;
}

/**
 * Busca todos os agendamentos confirmados do número de teste.
 */
export async function getTestBookings() {
  const { data } = await supabase
    .from('bookings')
    .select('id, booking_date, start_time, status, client_name')
    .eq('professional_id', TEST.PROFESSIONAL_ID)
    .eq('client_phone', TEST.PHONE)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false });

  return data ?? [];
}

/**
 * Retorna a data de um dia da semana próximo (0=Dom, 1=Seg ... 6=Sáb).
 * Pega sempre o próximo (nunca hoje).
 */
export function nextWeekday(dayOfWeek: number): string {
  const today = new Date();
  const result = new Date(today);
  let daysAhead = dayOfWeek - today.getDay();
  if (daysAhead <= 0) daysAhead += 7;
  result.setDate(today.getDate() + daysAhead);
  return result.toISOString().split('T')[0]; // YYYY-MM-DD
}
