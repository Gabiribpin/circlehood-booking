/**
 * Returns true if at least `businessDays` business days (Mon–Fri)
 * have elapsed since `fromDate` (inclusive of fromDate itself if it's a weekday).
 */
export function hasPassedBusinessDays(fromDate: Date, businessDays: number): boolean {
  const today = new Date();
  let count = 0;
  const current = new Date(fromDate);

  while (current <= today) {
    const dayOfWeek = current.getDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    if (count >= businessDays) return true;
    current.setDate(current.getDate() + 1);
  }

  return false;
}
