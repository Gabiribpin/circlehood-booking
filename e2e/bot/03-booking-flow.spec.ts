import { test, expect } from '@playwright/test';
import {
  cleanTestState,
  getLastBotMessage,
  getTestBookings,
  nextWeekday,
} from '../helpers/setup';
import { sendBotMessage } from '../helpers/webhook';

test.describe('Bot — Fluxo de Agendamento', () => {
  test.beforeEach(async () => {
    await cleanTestState();
  });

  test('fluxo feliz: oi → serviço+dia+hora → nome → booking criado no DB', async ({
    request,
  }) => {
    // Cada turno aguarda resposta do Claude (~10s) — 3 turnos = até 45s
    test.setTimeout(60_000);

    const monday = nextWeekday(1);
    const [day, month] = monday.split('-').slice(1).reverse().map(Number);

    // Turno 1: Saudação
    await sendBotMessage(request, 'oi');
    const greeting = await getLastBotMessage();
    expect(greeting).not.toBeNull();
    expect(greeting!.toLowerCase()).toMatch(/salao|salão|gabriela|bem[- ]?vindo|olá|oi/i);

    // Turno 2: Pedido completo (serviço + dia + horário)
    // 10h para evitar conflito com timezone-dst que usa 15h (serviço dura 2h → 15-17h)
    await sendBotMessage(
      request,
      `quero cortar cabelo na segunda dia ${day}/${month} às 10h`
    );
    const askName = await getLastBotMessage(greeting!);
    expect(askName).not.toBeNull();
    // Dia está disponível → bot deve pedir o nome (não rejeitar)
    expect(askName!.toLowerCase()).toMatch(/nome|como (você|te|vc) chama/i);
    expect(askName!.toLowerCase()).not.toMatch(/não atendo|nao atendo|fechado/i);

    // Turno 3: Informar o nome
    await sendBotMessage(request, 'Ana Teste E2E');
    const confirmation = await getLastBotMessage(askName!);
    expect(confirmation).not.toBeNull();
    // Bot deve confirmar o agendamento (sem "ana" — muito amplo, gera falso positivo em rejeições)
    expect(confirmation!.toLowerCase()).toMatch(/confirmado|agendado|marcado/i);

    // Verificar criação no banco
    const bookings = await getTestBookings();
    expect(bookings.length).toBeGreaterThanOrEqual(1);

    const booking = bookings[0];
    expect(booking.booking_date).toBe(monday);
    expect(booking.client_name.toLowerCase()).toContain('ana');
    expect(booking.start_time).toMatch(/^10:/);
  });

  test('bot rejeita domingo mas aceita segunda na mesma conversa', async ({
    request,
  }) => {
    test.setTimeout(60_000);

    const monday = nextWeekday(1);
    const [day, month] = monday.split('-').slice(1).reverse().map(Number);

    await sendBotMessage(request, 'oi');
    const greeting03 = await getLastBotMessage();
    expect(greeting03).not.toBeNull();
    await new Promise<void>((r) => setTimeout(r, 2000));

    // Pede domingo (inválido)
    await sendBotMessage(request, 'quero marcar para domingo às 9h');
    const rejection = await getLastBotMessage(greeting03!);
    expect(rejection!.toLowerCase()).toMatch(/não atendo|nao atendo|fechado|domingo/i);

    // Sem booking durante a tentativa inválida
    const bookingsDurante = await getTestBookings();
    expect(bookingsDurante).toHaveLength(0);

    // Corrige para segunda — bot deve engajar sem rejeitar o dia
    await sendBotMessage(
      request,
      `tudo bem, então quero marcar na segunda dia ${day}/${month} às 10h`
    );
    const response = await getLastBotMessage(rejection!);
    expect(response).not.toBeNull();
    // Bot aceita a segunda (não rejeita o dia)
    expect(response!.toLowerCase()).not.toMatch(/não atendo|nao atendo|fechado/i);
    // Bot avança no fluxo (pede nome, serviço, ou já confirma)
    expect(response!.toLowerCase()).toMatch(/nome|servi|confirmado|agendado|como/i);
  });
});
