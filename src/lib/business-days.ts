// src/lib/business-days.ts

/**
 * Calcula o número de dias úteis entre duas datas
 * Exclui sábados e domingos
 */
export function getBusinessDaysBetween(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    // 0 = Domingo, 6 = Sábado
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Adiciona dias úteis a uma data
 */
export function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let addedDays = 0;

  while (addedDays < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      addedDays++;
    }
  }

  return result;
}

/**
 * Verifica se já passaram N dias úteis desde uma data
 */
export function hasPassedBusinessDays(fromDate: Date, businessDays: number): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const from = new Date(fromDate);
  from.setHours(0, 0, 0, 0);

  const daysPassed = getBusinessDaysBetween(from, today);
  return daysPassed >= businessDays;
}
