/**
 * Funções puras de agendamento — extraídas de chatbot.ts para permitir testes unitários.
 */

/** Converte "HH:MM" ou "HH:MM:SS" em minutos desde meia-noite. */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Sugere o primeiro slot disponível dentro do expediente.
 * Aplica buffer de 15 min após cada atendimento.
 * Se date === hoje (Dublin), ignora horários que já passaram (+1h de margem).
 * Se afterTime for fornecido, a busca começa a partir desse horário (nunca sugere slot anterior).
 * Retorna null se não houver slot disponível para este dia.
 */
export function suggestAlternative(
  date: string,
  existingBookings: Array<{ start_time: string; end_time?: string | null }>,
  durationMinutes: number,
  workStartTime: string,
  workEndTime: string,
  afterTime?: string
): string | null {
  const workStartMins = timeToMinutes(workStartTime);
  const workEndMins = timeToMinutes(workEndTime);

  const nowDublin = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Dublin' }));
  const todayStr = nowDublin.toISOString().split('T')[0];
  const isToday = date === todayStr;

  const minMinutes = isToday
    ? Math.ceil((nowDublin.getHours() * 60 + nowDublin.getMinutes() + 60) / 60) * 60
    : workStartMins;

  if (isToday) {
    console.log(
      `⏰ Hoje Dublin ${nowDublin.getHours()}:${String(nowDublin.getMinutes()).padStart(2, '0')} → mínimo ${Math.floor(minMinutes / 60)}:00 | expediente ${workStartTime}–${workEndTime}`
    );
  }

  // Ponto de partida: o maior entre início do expediente, afterTime (horário pedido)
  // e o mínimo de hoje (para não sugerir horários passados).
  const afterMins = afterTime ? timeToMinutes(afterTime) : workStartMins;
  const startSearchMins = Math.max(workStartMins, afterMins, minMinutes);

  for (let slotMins = startSearchMins; slotMins + durationMinutes <= workEndMins; slotMins += 60) {
    const slotEnd = slotMins + durationMinutes;
    const slot = `${String(Math.floor(slotMins / 60)).padStart(2, '0')}:${String(slotMins % 60).padStart(2, '0')}`;
    const BUFFER = 15;
    const hasConflict = existingBookings.some((b) => {
      const bStart = timeToMinutes(b.start_time);
      const bEnd = (b.end_time ? timeToMinutes(b.end_time) : bStart + 60) + BUFFER;
      return slotMins < bEnd && slotEnd > bStart;
    });
    if (!hasConflict) return slot;
  }
  return null;
}

/** Normaliza string de data para YYYY-MM-DD. */
export function normalizeDate(dateStr: string): string {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const lower = dateStr.toLowerCase().trim();
  if (lower === 'hoje' || lower === 'today') return todayStr;
  if (lower === 'amanhã' || lower === 'amanha' || lower === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const dmy = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  console.warn('normalizeDate: data não reconhecida:', dateStr, '→ usando hoje');
  return todayStr;
}

/** Normaliza string de horário para HH:MM. */
export function normalizeTime(timeStr: string): string {
  const t = timeStr.trim();
  if (/^\d{1,2}[hH]$/.test(t)) return t.replace(/[hH]/, '').padStart(2, '0') + ':00';
  const hm = t.match(/^(\d{1,2})[hH](\d{2})$/);
  if (hm) return `${hm[1].padStart(2, '0')}:${hm[2]}`;
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) return t.slice(0, 5).padStart(5, '0');
  return t;
}

/**
 * Verifica se um slot tem conflito com agendamentos existentes (inclui buffer de 15 min).
 * Retorna true se houver conflito.
 */
export function hasTimeConflict(
  startTime: string,
  durationMinutes: number,
  existingBookings: Array<{ start_time: string; end_time?: string | null }>
): boolean {
  const BUFFER = 15;
  const reqStart = timeToMinutes(startTime);
  const reqEnd = reqStart + durationMinutes;

  return existingBookings.some((b) => {
    const bStart = timeToMinutes(b.start_time);
    const bEnd = (b.end_time ? timeToMinutes(b.end_time) : bStart + 60) + BUFFER;
    return reqStart < bEnd && reqEnd > bStart;
  });
}
