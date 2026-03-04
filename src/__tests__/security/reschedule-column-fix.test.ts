import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..');

describe('Reschedule routes use start_time instead of booking_time (#103)', () => {
  it('change/route.ts uses start_time for availability check', () => {
    const content = readFileSync(
      join(ROOT, 'src/app/api/reschedule/[token]/change/route.ts'),
      'utf-8'
    );
    expect(content).toContain("'start_time'");
    expect(content).not.toContain("'booking_time'");
    expect(content).not.toContain('booking_time:');
  });

  it('change/route.ts uses start_time for update', () => {
    const content = readFileSync(
      join(ROOT, 'src/app/api/reschedule/[token]/change/route.ts'),
      'utf-8'
    );
    expect(content).toContain('start_time: new_time');
  });

  it('[token]/route.ts selects start_time from bookings', () => {
    const content = readFileSync(
      join(ROOT, 'src/app/api/reschedule/[token]/route.ts'),
      'utf-8'
    );
    expect(content).toContain('start_time');
    expect(content).not.toContain('booking_time');
  });

  it('reschedule page.tsx renders start_time', () => {
    const content = readFileSync(
      join(ROOT, 'src/app/[locale]/(public)/reschedule/[token]/page.tsx'),
      'utf-8'
    );
    expect(content).toContain('start_time');
    expect(content).not.toContain('booking_time');
  });
});
