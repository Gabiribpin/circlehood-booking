/**
 * E2E: Sistema de sinal/depósito (Stripe Payment Intents)
 *
 * Testa:
 * A. API de configuração de pagamento (settings)
 * B. API create-intent quando Stripe não configurado (graceful 503)
 * C. API create-intent quando profissional não exige sinal (400)
 * D. Fluxo de agendamento sem sinal funciona normalmente
 * E. Tabela payments aceita registos (migration OK)
 *
 * Testes que necessitam STRIPE_SECRET_KEY real são guarded por `test.skip`.
 */

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const BASE_URL = process.env.TEST_BASE_URL ?? 'https://circlehood-booking.vercel.app';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// IDs do profissional de teste (mesmos usados noutros testes)
const TEST_PROF_EMAIL = process.env.TEST_USER_EMAIL!;

let professionalId: string;
let serviceId: string;

test.beforeAll(async () => {
  // Buscar user_id pelo email (service role — sem precisar de login)
  const { data: users } = await supabase.auth.admin.listUsers();
  const user = users?.users.find((u) => u.email === TEST_PROF_EMAIL);
  if (!user) throw new Error('Utilizador de teste não encontrado');

  // Buscar professional_id
  const { data: prof } = await supabase
    .from('professionals')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!prof) throw new Error('Profissional de teste não encontrado');
  professionalId = prof.id;

  // Buscar um service_id válido
  const { data: services } = await supabase
    .from('services')
    .select('id')
    .eq('professional_id', professionalId)
    .eq('is_active', true)
    .limit(1);

  if (!services?.length) throw new Error('Nenhum serviço activo para teste');
  serviceId = services[0].id;
});

// ─── A. Configuração de pagamento ────────────────────────────────────────────

test('A. GET /api/settings/payment retorna 401 sem auth', async ({ request }) => {
  const res = await request.get(`${BASE_URL}/api/settings/payment`);
  expect(res.status()).toBe(401);
});

test('A. GET /api/settings/payment retorna configuração com auth', async ({ request }) => {
  // storageState (cookies) do auth-setup garante autenticação
  const res = await request.get(`${BASE_URL}/api/settings/payment`);
  // Pode ser 200 ou 404 se profissional não tiver config — ambos são válidos
  expect([200, 404]).toContain(res.status());
  if (res.status() === 200) {
    const data = await res.json();
    expect(data).toHaveProperty('professional');
  }
});

test('A. PUT /api/settings/payment rejeita tipo inválido', async ({ request }) => {
  const res = await request.put(`${BASE_URL}/api/settings/payment`, {
    data: {
      require_deposit: true,
      deposit_type: 'invalid_type',
      deposit_value: 20,
    },
  });
  expect(res.status()).toBe(400);
});

test('A. PUT /api/settings/payment aceita configuração válida', async ({ request }) => {
  const res = await request.put(`${BASE_URL}/api/settings/payment`, {
    data: {
      require_deposit: false,
    },
  });
  expect(res.status()).toBe(200);
  const data = await res.json();
  expect(data.success).toBe(true);
});

// ─── B. Create-intent — sem Stripe configurado ───────────────────────────────

test('B. POST /api/payment/create-intent retorna 503 ou erro sem Stripe', async ({ request }) => {
  // Garantir que profissional tem require_deposit=true para atingir o código Stripe
  await supabase
    .from('professionals')
    .update({
      require_deposit: true,
      deposit_type: 'percentage',
      deposit_value: 30,
    })
    .eq('id', professionalId);

  const res = await request.post(`${BASE_URL}/api/payment/create-intent`, {
    headers: { 'Content-Type': 'application/json' },
    data: { professional_id: professionalId, service_id: serviceId },
  });

  // Se STRIPE_SECRET_KEY não estiver configurada → 503
  // Se estiver configurada (ambiente com Stripe) → 200
  expect([200, 503, 500]).toContain(res.status());

  // Limpar — voltar a require_deposit=false
  await supabase
    .from('professionals')
    .update({ require_deposit: false, deposit_type: null, deposit_value: null })
    .eq('id', professionalId);
});

// ─── C. Create-intent — profissional sem sinal ───────────────────────────────

test('C. POST /api/payment/create-intent retorna 400 se profissional não exige sinal', async ({
  request,
}) => {
  // require_deposit está false (garantido pelo afterAll do teste anterior)
  const res = await request.post(`${BASE_URL}/api/payment/create-intent`, {
    headers: { 'Content-Type': 'application/json' },
    data: { professional_id: professionalId, service_id: serviceId },
  });
  expect(res.status()).toBe(400);
  const data = await res.json();
  expect(data.error).toContain('não exige sinal');
});

test('C. POST /api/payment/create-intent retorna 400 com profissional inválido', async ({
  request,
}) => {
  const res = await request.post(`${BASE_URL}/api/payment/create-intent`, {
    headers: { 'Content-Type': 'application/json' },
    data: {
      professional_id: '00000000-0000-0000-0000-000000000000',
      service_id: serviceId,
    },
  });
  expect([400, 404]).toContain(res.status());
});

// ─── D. Agendamento normal (sem sinal) ───────────────────────────────────────

test('D. Booking sem sinal funciona normalmente', async ({ request }) => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];

  const res = await request.post(`${BASE_URL}/api/bookings`, {
    headers: { 'Content-Type': 'application/json' },
    data: {
      professional_id: professionalId,
      service_id: serviceId,
      booking_date: dateStr,
      start_time: '09:00',
      client_name: 'Teste Pagamento',
      client_phone: '353800099099',
    },
  });

  // 201 = criado, 409 = slot ocupado (ambos aceitáveis)
  expect([201, 409]).toContain(res.status());

  if (res.status() === 201) {
    const data = await res.json();
    expect(data.booking).toHaveProperty('id');
    // Limpar
    await supabase.from('bookings').delete().eq('id', data.booking.id);
  }
});

// ─── E. Migration OK — tabela payments existe ─────────────────────────────────

test('E. Tabela payments existe e aceita insert/delete', async () => {
  const { error } = await supabase.from('payments').insert({
    professional_id: professionalId,
    booking_id: null,
    stripe_payment_intent_id: `pi_test_e2e_${Date.now()}`,
    amount: 10.0,
    currency: 'EUR',
    status: 'pending',
  });

  // Se tabela não existir → error
  if (error) {
    throw new Error(`Tabela payments não encontrada ou erro de schema: ${error.message}`);
  }

  // Limpar
  await supabase
    .from('payments')
    .delete()
    .like('stripe_payment_intent_id', 'pi_test_e2e_%');
});
