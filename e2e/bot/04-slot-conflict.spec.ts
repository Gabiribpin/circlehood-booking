import { test, expect } from '@playwright/test';
import {
  cleanTestState,
  getLastBotMessage,
  getTestBookings,
  nextWeekday,
} from '../helpers/setup';
import { sendBotMessage } from '../helpers/webhook';
import { createClient } from '@supabase/supabase-js';
import { TEST } from '../helpers/config';

/**
 * Cria um booking diretamente no banco (bypassa o bot) para simular
 * um slot ocupado sem depender de um fluxo completo anterior.
 */
async function seedBooking(date: string, time: string) {
  const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);
  const { error } = await supabase.from('bookings').insert({
    professional_id: TEST.PROFESSIONAL_ID,
    client_phone: '353800000001', // telefone diferente do teste
    client_name: 'Cliente Seed',
    service_id: null,
    booking_date: date,
    start_time: time,
    end_time: incrementTime(time, 30),
    status: 'confirmed',
  });
  if (error) throw new Error(`seedBooking failed: ${error.message}`);
}

async function cleanSeedBookings(date: string) {
  const supabase = createClient(TEST.SUPABASE_URL, TEST.SUPABASE_SERVICE_KEY);
  await supabase
    .from('bookings')
    .update({ status: 'cancelled', cancelled_by: 'system' })
    .eq('professional_id', TEST.PROFESSIONAL_ID)
    .eq('client_phone', '353800000001')
    .eq('booking_date', date);
}

function incrementTime(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = String(Math.floor(total / 60)).padStart(2, '0');
  const mm = String(total % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

test.describe('Bot — Conflito de Horário', () => {
  let monday: string;
  let day: number;
  let month: number;

  test.beforeAll(() => {
    monday = nextWeekday(1);
    [day, month] = monday.split('-').slice(1).reverse().map(Number);
  });

  test.beforeEach(async () => {
    await cleanTestState();
  });

  test.afterEach(async () => {
    await cleanSeedBookings(monday);
  });

  test('rejeita slot ocupado e NÃO cria booking duplicado', async ({ request }) => {
    test.setTimeout(60_000);

    // Criar um booking existente no horário das 15h
    await seedBooking(monday, '15:00');

    await sendBotMessage(request, 'oi');

    // Tentar agendar no slot ocupado
    await sendBotMessage(
      request,
      `quero cortar cabelo na segunda dia ${day}/${month} às 15h`
    );

    const reply = await getLastBotMessage();
    expect(reply).not.toBeNull();

    // Bot deve informar conflito (não perguntar nome)
    expect(reply!.toLowerCase()).toMatch(
      /ocupado|indisponível|indisponivel|já tem|nao disponível|nao disponivel|outro horário|outro horario/i
    );
    expect(reply!.toLowerCase()).not.toMatch(/nome|como (você|te|vc) chama/i);

    // Nenhum booking deve ter sido criado para o telefone de teste
    const bookings = await getTestBookings();
    expect(bookings).toHaveLength(0);
  });

  test('aceita slot livre mesmo com outro booking no mesmo dia', async ({ request }) => {
    test.setTimeout(90_000);

    // Criar booking às 14h — o slot das 13h deve estar livre
    await seedBooking(monday, '14:00');

    await sendBotMessage(request, 'oi');

    await sendBotMessage(
      request,
      `quero cortar cabelo na segunda dia ${day}/${month} às 13h`
    );

    const askName = await getLastBotMessage();
    expect(askName).not.toBeNull();
    // 13h está livre → bot pede o nome
    expect(askName!.toLowerCase()).toMatch(/nome|como (você|te|vc) chama/i);

    await sendBotMessage(request, 'Carla Livre');
    const confirmation = await getLastBotMessage();
    expect(confirmation!.toLowerCase()).toMatch(/confirmado|agendado|marcado/i);

    const bookings = await getTestBookings();
    expect(bookings.length).toBe(1);
    expect(bookings[0].start_time).toMatch(/^13:/);
  });
});
