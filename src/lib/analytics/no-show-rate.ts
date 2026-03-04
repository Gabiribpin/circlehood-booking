export function computeNoShowMetrics(bookings: { status: string }[]) {
  const total = bookings.length;
  const noShows = bookings.filter((b) => b.status === 'no_show').length;
  const rate = total > 0 ? (noShows / total) * 100 : 0;
  return { noShows, total, rate };
}
