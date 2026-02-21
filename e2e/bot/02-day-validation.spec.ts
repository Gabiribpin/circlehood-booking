import { test, expect } from '@playwright/test';
import { cleanTestState, getLastBotMessage, getTestBookings, nextWeekday } from '../helpers/setup';
import { sendBotMessage } from '../helpers/webhook';

test.describe('Bot — Validação de Dia', () => {
  test.beforeEach(async () => {
    await cleanTestState();
  });

  test('rejeita domingo ANTES de pedir o nome', async ({ request }) => {
    // Próximo domingo
    const sunday = nextWeekday(0);
    const [day, month] = sunday.split('-').slice(1).reverse().map(Number);

    await sendBotMessage(request, 'oi');
    await sendBotMessage(request, `quero cortar cabelo no dia ${day}/${month} às 10h`);

    const reply = await getLastBotMessage();
    expect(reply).not.toBeNull();

    // Bot deve rejeitar o dia (não atende domingos)
    expect(reply!.toLowerCase()).toMatch(/não atendo|nao atendo|fechado|domingo/i);

    // Não deve ter criado agendamento
    const bookings = await getTestBookings();
    expect(bookings).toHaveLength(0);
  });

  test('rejeita dia de folga antes de perguntar nome', async ({ request }) => {
    await sendBotMessage(request, 'oi');
    await sendBotMessage(request, 'quero marcar para domingo às 9h');

    const reply = await getLastBotMessage();
    expect(reply).not.toBeNull();

    // Bot deve rejeitar, não perguntar nome
    expect(reply!.toLowerCase()).toMatch(/não atendo|nao atendo|fechado|domingo/i);
    expect(reply!.toLowerCase()).not.toContain('nome');
  });

  test('aceita segunda-feira (dia útil)', async ({ request }) => {
    const monday = nextWeekday(1);
    const [day, month] = monday.split('-').slice(1).reverse().map(Number);

    await sendBotMessage(request, 'oi');
    await sendBotMessage(request, `quero cortar cabelo na segunda dia ${day}/${month} às 10h`);

    const reply = await getLastBotMessage();
    expect(reply).not.toBeNull();

    // Bot deve pedir o nome (dia aceito)
    expect(reply!.toLowerCase()).toMatch(/nome|como (você|te) chama/i);
    expect(reply!.toLowerCase()).not.toMatch(/não atendo|nao atendo|fechado/i);
  });
});
