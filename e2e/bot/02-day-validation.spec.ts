import { test, expect } from '@playwright/test';
import { cleanTestState, getLastBotMessage, getTestBookings, nextWeekday } from '../helpers/setup';
import { sendBotMessage } from '../helpers/webhook';

test.describe('Bot — Validação de Dia', () => {
  test.beforeEach(async () => {
    await cleanTestState();
  });

  test('rejeita domingo ANTES de pedir o nome', async ({ request }) => {
    // Próximo domingo no formato dia/mês (natural language — ISO confunde o LLM)
    const sunday = nextWeekday(0);
    const [, sMonth, sDay] = sunday.split('-').map(Number);

    await sendBotMessage(request, 'oi');
    // Confirmação ativa: espera o turno 1 ser commitado no DB antes de continuar.
    // Protege contra cold start do Vercel (Redis lazy connect) onde um delay fixo
    // não é suficiente — o isFirstMessage no turno 2 seria true sem essa garantia.
    const greeting = await getLastBotMessage();
    expect(greeting).not.toBeNull();
    await new Promise<void>((r) => setTimeout(r, 2000)); // buffer para Redis propagar

    await sendBotMessage(request, `quero cortar cabelo no domingo dia ${sDay}/${sMonth} às 10h`);

    // Passa greeting como skipContent para não retornar o turno 1 caso o turno 2 ainda não tenha chegado
    const reply = await getLastBotMessage(greeting!);
    expect(reply).not.toBeNull();

    // Bot deve rejeitar o dia (não atende domingos)
    expect(reply!.toLowerCase()).toMatch(/não atendo|nao atendo|fechado|domingo/i);

    // Não deve ter criado agendamento
    const bookings = await getTestBookings();
    expect(bookings).toHaveLength(0);
  });

  test('rejeita dia de folga antes de perguntar nome', async ({ request }) => {
    await sendBotMessage(request, 'oi');
    const greeting = await getLastBotMessage();
    expect(greeting).not.toBeNull();
    await new Promise<void>((r) => setTimeout(r, 2000));

    await sendBotMessage(request, 'quero marcar para domingo às 9h');

    const reply = await getLastBotMessage(greeting!);
    expect(reply).not.toBeNull();

    // Bot deve rejeitar, não perguntar nome
    expect(reply!.toLowerCase()).toMatch(/não atendo|nao atendo|fechado|domingo/i);
    expect(reply!.toLowerCase()).not.toContain('nome');
  });

  test('aceita segunda-feira (dia útil)', async ({ request }) => {
    const monday = nextWeekday(1);
    const [day, month] = monday.split('-').slice(1).reverse().map(Number);

    await sendBotMessage(request, 'oi');
    const greeting = await getLastBotMessage();
    expect(greeting).not.toBeNull();
    await new Promise<void>((r) => setTimeout(r, 2000));

    // Não especifica horário — bot deve aceitar o dia e pedir mais informações
    await sendBotMessage(request, `quero cortar cabelo na segunda dia ${day}/${month}`);

    const reply = await getLastBotMessage(greeting!);
    expect(reply).not.toBeNull();

    // Segunda é dia útil — bot não deve rejeitar o dia
    expect(reply!.toLowerCase()).not.toMatch(/não atendo|nao atendo|fechado/i);
    // Bot deve estar engajado: pedir horário, nome, ou confirmar o dia
    expect(reply!.toLowerCase()).toMatch(/horário|nome|qual|quando|como/i);
  });
});
