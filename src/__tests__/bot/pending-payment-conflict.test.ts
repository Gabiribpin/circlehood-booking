import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #8: Bot ignores pending_payment as occupied slot
 *
 * All conflict checks in chatbot.ts must use positive filter
 * .in('status', ['confirmed', 'pending_payment']) instead of
 * negative filter .neq('status', 'cancelled').neq('status', 'completed')
 */

const chatbotPath = resolve('src/lib/ai/chatbot.ts');

describe('Bot: pending_payment treated as occupied slot (issue #8)', () => {
  const source = readFileSync(chatbotPath, 'utf-8');

  it('uses positive status filter for check_availability conflict query', () => {
    // check_availability: "Verificar conflitos reais com agendamentos existentes"
    expect(source).toContain(".in('status', ['confirmed', 'pending_payment'])");
  });

  it('uses positive status filter for createAppointment conflict query', () => {
    // createAppointment: "5. Verificar conflitos de horário"
    const createSection = source.slice(source.indexOf('5. Verificar conflitos de horário'));
    expect(createSection).toContain(".in('status', ['confirmed', 'pending_payment'])");
  });

  it('uses positive status filter for future bookings duplicate check', () => {
    // createAppointment: "3. Verificar agendamentos futuros do mesmo cliente"
    const futureSection = source.slice(source.indexOf('agendamentos futuros do mesmo cliente'));
    expect(futureSection).toContain(".in('status', ['confirmed', 'pending_payment'])");
  });

  it('uses positive status filter for tomorrow availability check', () => {
    // suggestAlternative: tomorrow bookings query
    const tomorrowSection = source.slice(source.indexOf("eq('booking_date', tomorrowStr)"));
    expect(tomorrowSection).toContain(".in('status', ['confirmed', 'pending_payment'])");
  });

  it('does NOT use negative .neq status filters for conflict queries', () => {
    // Ensure no .neq('status', 'cancelled') remains
    expect(source).not.toContain(".neq('status', 'cancelled')");
    expect(source).not.toContain(".neq('status', 'completed')");
  });

  it('has at least 4 positive status filters (one per query)', () => {
    const matches = source.match(/\.in\('status', \['confirmed', 'pending_payment'\]\)/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(4);
  });

  it('bookings/route.ts also uses positive filter (consistency check)', () => {
    const bookingsSource = readFileSync(
      resolve('src/app/api/bookings/route.ts'),
      'utf-8'
    );
    expect(bookingsSource).toContain(".in('status', ['confirmed', 'pending_payment'])");
  });
});
