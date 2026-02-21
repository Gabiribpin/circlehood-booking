import { describe, it, expect } from 'vitest';
import {
  timeToMinutes,
  normalizeDate,
  normalizeTime,
  suggestAlternative,
  hasTimeConflict,
} from './booking-utils';

// ─── timeToMinutes ───────────────────────────────────────────────────────────

describe('timeToMinutes', () => {
  it('converte HH:MM corretamente', () => {
    expect(timeToMinutes('09:00')).toBe(540);
    expect(timeToMinutes('18:30')).toBe(1110);
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('23:59')).toBe(1439);
  });

  it('ignora segundos (HH:MM:SS)', () => {
    expect(timeToMinutes('10:30:00')).toBe(630);
  });
});

// ─── normalizeTime ────────────────────────────────────────────────────────────

describe('normalizeTime', () => {
  it('converte "18h" → "18:00"', () => {
    expect(normalizeTime('18h')).toBe('18:00');
    expect(normalizeTime('9h')).toBe('09:00');
  });

  it('converte "18h30" → "18:30"', () => {
    expect(normalizeTime('18h30')).toBe('18:30');
    expect(normalizeTime('9h05')).toBe('09:05');
  });

  it('mantém "HH:MM" como está', () => {
    expect(normalizeTime('10:00')).toBe('10:00');
    expect(normalizeTime('08:30')).toBe('08:30');
  });

  it('trunca "HH:MM:SS" para "HH:MM"', () => {
    expect(normalizeTime('14:00:00')).toBe('14:00');
  });

  it('retorna string desconhecida sem alterar', () => {
    expect(normalizeTime('meio-dia')).toBe('meio-dia');
  });
});

// ─── normalizeDate ────────────────────────────────────────────────────────────

describe('normalizeDate', () => {
  it('retorna YYYY-MM-DD sem alterar', () => {
    expect(normalizeDate('2026-03-15')).toBe('2026-03-15');
  });

  it('converte DD/MM/YYYY para YYYY-MM-DD', () => {
    expect(normalizeDate('15/03/2026')).toBe('2026-03-15');
    expect(normalizeDate('5/3/2026')).toBe('2026-03-05');
  });

  it('converte DD-MM-YYYY para YYYY-MM-DD', () => {
    expect(normalizeDate('15-03-2026')).toBe('2026-03-15');
  });

  it('"hoje" retorna data de hoje', () => {
    const today = new Date().toISOString().split('T')[0];
    expect(normalizeDate('hoje')).toBe(today);
    expect(normalizeDate('today')).toBe(today);
  });

  it('"amanhã" retorna data de amanhã', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    expect(normalizeDate('amanhã')).toBe(tomorrowStr);
    expect(normalizeDate('amanha')).toBe(tomorrowStr);
    expect(normalizeDate('tomorrow')).toBe(tomorrowStr);
  });
});

// ─── hasTimeConflict ──────────────────────────────────────────────────────────

describe('hasTimeConflict', () => {
  it('retorna false quando não há agendamentos', () => {
    expect(hasTimeConflict('10:00', 60, [])).toBe(false);
  });

  it('detecta conflito direto (sobreposição)', () => {
    const bookings = [{ start_time: '10:00', end_time: '11:00' }];
    // Tenta marcar 10:30 por 60 min → conflito
    expect(hasTimeConflict('10:30', 60, bookings)).toBe(true);
  });

  it('detecta conflito por buffer de 15 min', () => {
    const bookings = [{ start_time: '10:00', end_time: '11:00' }];
    // 11:00 + 15 min buffer = 11:15
    // Tenta 11:05 → start(665) < bEnd(675) → conflito
    expect(hasTimeConflict('11:05', 60, bookings)).toBe(true);
  });

  it('permite agendamento após buffer (11:15 em diante)', () => {
    const bookings = [{ start_time: '10:00', end_time: '11:00' }];
    // 11:15 = bEnd com buffer → sem conflito
    expect(hasTimeConflict('11:15', 60, bookings)).toBe(false);
  });

  it('detecta conflito sem end_time (assume 60 min padrão)', () => {
    const bookings = [{ start_time: '10:00' }]; // sem end_time
    // bEnd = 10:00 + 60 min + 15 buffer = 11:15
    expect(hasTimeConflict('11:00', 60, bookings)).toBe(true);
    expect(hasTimeConflict('11:15', 60, bookings)).toBe(false);
  });

  it('sem conflito quando slot é antes do agendamento existente', () => {
    const bookings = [{ start_time: '14:00', end_time: '15:00' }];
    // 09:00–10:00 não conflita com 14:00–15:15
    expect(hasTimeConflict('09:00', 60, bookings)).toBe(false);
  });

  it('detecta conflito com serviço de 120 min', () => {
    const bookings = [{ start_time: '14:00', end_time: '16:00' }];
    // 15:00 + 120 min = 17:00 → conflita com 14:00–16:15 (com buffer)
    expect(hasTimeConflict('15:00', 120, bookings)).toBe(true);
  });
});

// ─── suggestAlternative ───────────────────────────────────────────────────────

describe('suggestAlternative', () => {
  // Data fixa no futuro para não depender de "hoje"
  const FUTURE_DATE = '2099-12-25';
  const WORK_START = '09:00';
  const WORK_END = '18:00';

  it('retorna primeiro slot do expediente quando não há agendamentos', () => {
    expect(suggestAlternative(FUTURE_DATE, [], 60, WORK_START, WORK_END)).toBe('09:00');
  });

  it('pula slot ocupado e retorna próximo', () => {
    const bookings = [{ start_time: '09:00', end_time: '10:00' }];
    // 09:00 ocupado; 10:00 tem buffer até 10:15 → pula; 11:00 disponível
    expect(suggestAlternative(FUTURE_DATE, bookings, 60, WORK_START, WORK_END)).toBe('11:00');
  });

  it('aplica buffer corretamente: agendamento 09:00–10:00 bloqueia até 10:14', () => {
    const bookings = [{ start_time: '09:00', end_time: '10:00' }];
    // 10:00 slot: slotEnd=11:00; bEnd=10:15 → 10:00 < 10:15 E 11:00 > 09:00 → conflito
    // 11:00 slot: slotEnd=12:00; bEnd=10:15 → 11:00 >= 10:15 → sem conflito
    const result = suggestAlternative(FUTURE_DATE, bookings, 60, WORK_START, WORK_END);
    expect(result).toBe('11:00');
  });

  it('sugere corretamente com serviço de 120 min', () => {
    const bookings = [{ start_time: '09:00', end_time: '11:00' }];
    // 09:00: conflito; 10:00: conflito (10:00 < 11:15); 11:00: slotEnd=13:00; bEnd=11:15 → 11:00 < 11:15 → conflito
    // 12:00: slotEnd=14:00; bEnd=11:15 → 12:00 >= 11:15 → sem conflito
    expect(suggestAlternative(FUTURE_DATE, bookings, 120, WORK_START, WORK_END)).toBe('12:00');
  });

  it('retorna null quando não há slot disponível no expediente', () => {
    // Expediente 09:00–10:00, serviço de 60 min; após buffer do único booking, sem espaço
    const bookings = [{ start_time: '09:00', end_time: '10:00' }];
    expect(suggestAlternative(FUTURE_DATE, bookings, 60, '09:00', '10:00')).toBeNull();
  });

  it('retorna null quando serviço não cabe no expediente', () => {
    // Expediente de 1h, serviço de 2h
    expect(suggestAlternative(FUTURE_DATE, [], 120, '09:00', '10:00')).toBeNull();
  });

  it('com afterTime: nunca sugere slot anterior ao horário pedido', () => {
    // 15:00 está ocupado; sem afterTime retornaria 09:00 (bug original)
    // com afterTime='15:00': 15:00 conflita, 16:00 conflita por buffer (16:00 + 15min), próximo é 17:00
    const bookings = [{ start_time: '15:00', end_time: '16:00' }];
    const result = suggestAlternative(FUTURE_DATE, bookings, 60, WORK_START, WORK_END, '15:00');
    expect(result).toBe('17:00');
    // Garante que NÃO retornou slots anteriores às 15:00
    expect(result).not.toBe('09:00');
    expect(result).not.toBe('10:00');
    expect(result).not.toBe('11:00');
  });

  it('com afterTime: ignora todos os slots antes mesmo que estejam livres', () => {
    // 14:00 e 15:00 ocupados; afterTime='14:00'
    // 09:00–13:00 livres mas devem ser ignorados; próximo após 14:00 é 17:00 (depois do buffer de 15:00–16:15)
    const bookings = [
      { start_time: '14:00', end_time: '15:00' },
      { start_time: '15:00', end_time: '16:00' },
    ];
    const result = suggestAlternative(FUTURE_DATE, bookings, 60, WORK_START, WORK_END, '14:00');
    // Deve ser >= 14:00 (nunca 09:00–13:00)
    expect(result).not.toBeNull();
    expect(timeToMinutes(result!)).toBeGreaterThanOrEqual(timeToMinutes('14:00'));
  });

  it('com afterTime: retorna null quando não há slot livre após o horário pedido', () => {
    // Expediente 09:00–18:00; afterTime='17:00'; serviço de 60 min; 17:00 ocupado até 18:00
    const bookings = [{ start_time: '17:00', end_time: '18:00' }];
    expect(suggestAlternative(FUTURE_DATE, bookings, 60, WORK_START, WORK_END, '17:00')).toBeNull();
  });

  it('com afterTime: afterTime anterior ao expediente usa início do expediente', () => {
    // afterTime='07:00' (antes de 09:00): deve começar de 09:00
    expect(suggestAlternative(FUTURE_DATE, [], 60, WORK_START, WORK_END, '07:00')).toBe('09:00');
  });

  it('ignora horários passados quando date === hoje', () => {
    const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Dublin' }))
      .toISOString()
      .split('T')[0];
    // Resultado deve ser null ou um slot no futuro (nunca "09:00" se já passou)
    const result = suggestAlternative(today, [], 60, '00:00', '23:59');
    if (result !== null) {
      const resultMins = timeToMinutes(result);
      const nowDublin = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Dublin' }));
      const nowMins = nowDublin.getHours() * 60 + nowDublin.getMinutes();
      // Slot deve ser pelo menos 1h no futuro
      expect(resultMins).toBeGreaterThan(nowMins);
    }
  });
});
