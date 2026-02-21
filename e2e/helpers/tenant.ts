/**
 * Helpers para testes de isolamento multi-tenant.
 * Cria/destrói profissionais reais no Supabase para simular dois tenants separados.
 */
import { createClient } from '@supabase/supabase-js';
import Redis from 'ioredis';
import { TEST } from './config';

const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);

export interface TestProfessional {
  id: string;
  userId: string;
  slug: string;
  serviceId: string;
  /** Telefone exclusivo de cliente para este profissional nos testes. */
  clientPhone: string;
}

/**
 * Cria um profissional temporário completo (auth user + professional + service + working_hours).
 * Use tag curta e única (ex: 'a', 'b') para identificar cada tenant nos testes.
 * Sempre chamar cleanupIsolationProfessional() no afterAll.
 */
export async function createIsolationProfessional(tag: string): Promise<TestProfessional> {
  const ts = Date.now();
  const email = `e2e-iso-${tag}-${ts}@circlehood-test.io`;
  // Telefone único por run (evita colisão entre execuções paralelas)
  const clientPhone = `35380${tag.charCodeAt(0)}${String(ts).slice(-5)}`;

  // ── 1. Auth user ──────────────────────────────────────────────────────────
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password: 'E2eIsolation1234!',
    email_confirm: true,
  });
  if (authErr || !authData.user) {
    throw new Error(`[tenant] createUser falhou: ${authErr?.message}`);
  }
  const userId = authData.user.id;

  // ── 2. Professional record ────────────────────────────────────────────────
  const { data: prof, error: profErr } = await supabase
    .from('professionals')
    .insert({
      user_id: userId,
      slug: `e2e-iso-${tag}-${ts}`,
      business_name: `E2E Isolation ${tag.toUpperCase()}`,
      subscription_status: 'active',
      trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      is_active: true,
      currency: 'EUR',
    })
    .select('id, slug')
    .single();
  if (profErr) {
    await supabase.auth.admin.deleteUser(userId).catch(() => {});
    throw new Error(`[tenant] createProfessional falhou: ${profErr.message}`);
  }

  // ── 3. Service ────────────────────────────────────────────────────────────
  const { data: service, error: svcErr } = await supabase
    .from('services')
    .insert({
      professional_id: prof.id,
      name: `Serviço Isolamento ${tag.toUpperCase()}`,
      duration_minutes: 60,
      price: 50,
      is_active: true,
    })
    .select('id')
    .single();
  if (svcErr) {
    throw new Error(`[tenant] createService falhou: ${svcErr.message}`);
  }

  // ── 4. Working hours (Seg–Sáb 09:00–18:00) ───────────────────────────────
  await supabase.from('working_hours').insert(
    [1, 2, 3, 4, 5, 6].map((day) => ({
      professional_id: prof.id,
      day_of_week: day,
      start_time: '09:00:00',
      end_time: '18:00:00',
      is_available: true,
    }))
  );

  return { id: prof.id, userId, slug: prof.slug, serviceId: service.id, clientPhone };
}

/**
 * Remove todos os dados do profissional de teste em ordem segura (FK constraints).
 */
export async function cleanupIsolationProfessional(prof: TestProfessional): Promise<void> {
  await supabase.from('bookings').delete().eq('professional_id', prof.id);
  await supabase.from('working_hours').delete().eq('professional_id', prof.id);
  await supabase.from('services').delete().eq('professional_id', prof.id);
  try { await supabase.from('contacts').delete().eq('professional_id', prof.id); } catch { /* sem tabela contacts — ignorar */ }
  await supabase.from('professionals').delete().eq('id', prof.id);
  await supabase.auth.admin.deleteUser(prof.userId).catch(() => {});
}

/**
 * Insere um booking diretamente no banco (sem passar pela API pública).
 * Retorna o ID do booking criado.
 */
export async function createBookingInDB(
  profId: string,
  serviceId: string,
  clientPhone: string,
  date: string,
  startTime = '10:00'
): Promise<string> {
  const [h] = startTime.split(':').map(Number);
  const endTime = `${String(h + 1).padStart(2, '0')}:00`;

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      professional_id: profId,
      service_id: serviceId,
      booking_date: date,
      start_time: `${startTime}:00`,
      end_time: `${endTime}:00`,
      client_name: `Cliente Isolamento ${profId.slice(0, 6)}`,
      client_phone: clientPhone,
      status: 'confirmed',
    })
    .select('id')
    .single();
  if (error) throw new Error(`[tenant] createBooking falhou: ${error.message}`);
  return data.id;
}

/** Retorna o status atual de um booking pelo ID. */
export async function getBookingStatus(bookingId: string): Promise<string | null> {
  const { data } = await supabase
    .from('bookings')
    .select('status')
    .eq('id', bookingId)
    .single();
  return data?.status ?? null;
}

/**
 * Retorna todos os bookings não-cancelados de um profissional.
 * Opcionalmente filtra por client_phone.
 */
export async function getActiveBookingsForProfessional(profId: string, phone?: string) {
  let query = supabase
    .from('bookings')
    .select('id, status, client_phone, professional_id, booking_date')
    .eq('professional_id', profId)
    .neq('status', 'cancelled');
  if (phone) query = query.eq('client_phone', phone);
  const { data } = await query;
  return data ?? [];
}

/**
 * Adiciona um contato para um profissional diretamente no banco.
 * Retorna o ID do contato criado.
 */
export async function addContact(
  profId: string,
  contact: { name: string; phone: string; email?: string }
): Promise<string> {
  const { data, error } = await supabase
    .from('contacts')
    .insert({ professional_id: profId, ...contact })
    .select('id')
    .single();
  if (error) throw new Error(`[tenant] addContact falhou: ${error.message}`);
  return data.id;
}

/**
 * Retorna todos os contatos de um profissional.
 */
export async function getContactsForProfessional(profId: string) {
  const { data } = await supabase
    .from('contacts')
    .select('id, name, phone, professional_id')
    .eq('professional_id', profId);
  return data ?? [];
}

/**
 * Limpa o estado conversacional do bot (Redis + Supabase + in-memory)
 * para o contexto de um profissional específico.
 */
export async function cleanBotStateForPhone(userId: string, phone: string): Promise<void> {
  // 1. Apagar conversa/mensagens do profissional
  const { data: conv } = await supabase
    .from('whatsapp_conversations')
    .select('id')
    .eq('user_id', userId)
    .eq('customer_phone', phone)
    .maybeSingle();
  if (conv) {
    await supabase.from('whatsapp_messages').delete().eq('conversation_id', conv.id);
    await supabase.from('whatsapp_conversations').delete().eq('id', conv.id);
  }

  // 2. Redis
  if (TEST.REDIS_URL) {
    try {
      const redis = new Redis(TEST.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: 3000 });
      await redis.del(`conversation:${userId}_${phone}`);
      redis.disconnect();
    } catch { /* não crítico */ }
  }

  // 3. In-memory Vercel
  await fetch(`${TEST.BASE_URL}/api/admin/clear-bot-cache`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-secret': TEST.CRON_SECRET },
    body: JSON.stringify({ business_id: userId, phone }),
  }).catch(() => {});
}
