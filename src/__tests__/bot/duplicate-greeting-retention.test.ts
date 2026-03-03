import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #46: Bot duplicate messages + retention in English with E2E data
 *
 * Three bugs fixed:
 * 1. Greeting lock failure falls through to Claude → duplicate greeting
 * 2. Maintenance reminder language based on phone prefix only → English for PT-BR professionals
 * 3. E2E test bookings not filtered → cron sends retention for "[E2E] Teste vida útil"
 */

// ─── Bug 1: Duplicate greeting suppression ──────────────────────────────────

describe('Bug 1: Greeting lock failure returns empty (no duplicate)', () => {
  it('chatbot.ts returns empty string when greeting lock fails', () => {
    const source = readFileSync(resolve('src/lib/ai/chatbot.ts'), 'utf-8');

    // When lock is NOT acquired, should return '' instead of continuing to Claude
    expect(source).toContain("return '';");
    // Old behavior should NOT exist: falling through to Claude on lock failure
    expect(source).not.toContain('processando como mensagem normal');
  });

  it('processor.ts guards against empty responses', () => {
    const source = readFileSync(resolve('src/lib/whatsapp/processor.ts'), 'utf-8');

    // Processor should check for empty response before sending
    expect(source).toContain('if (!response)');
    expect(source).toContain('duplicata suprimida');
  });
});

// ─── Bug 2: Maintenance reminder language resolution ──────────────────────────

describe('Bug 2: Maintenance reminder uses professional locale for language', () => {
  it('send-maintenance-reminders includes resolveLanguage function', () => {
    const source = readFileSync(
      resolve('src/app/api/cron/send-maintenance-reminders/route.ts'),
      'utf-8'
    );

    // Should have resolveLanguage that uses professional locale
    expect(source).toContain('function resolveLanguage');
    expect(source).toContain('professionalLocale');
  });

  it('queries professionals with locale field', () => {
    const source = readFileSync(
      resolve('src/app/api/cron/send-maintenance-reminders/route.ts'),
      'utf-8'
    );

    // Should select locale from professionals
    expect(source).toContain("'id, user_id, locale'");
  });

  it('uses resolveLanguage instead of detectLanguage for message generation', () => {
    const source = readFileSync(
      resolve('src/app/api/cron/send-maintenance-reminders/route.ts'),
      'utf-8'
    );

    // Should call resolveLanguage with professional locale and phone
    expect(source).toContain('resolveLanguage(profInfo?.locale, phone)');
    // Old detectLanguage(phone) should NOT be used in the loop
    expect(source).not.toMatch(/const lang = detectLanguage\(phone\)/);
  });

  it('resolveLanguage: pt-BR locale returns pt', () => {
    const source = readFileSync(
      resolve('src/app/api/cron/send-maintenance-reminders/route.ts'),
      'utf-8'
    );
    // The function checks if locale starts with 'pt'
    expect(source).toContain("professionalLocale.startsWith('pt')");
  });

  it('resolveLanguage: falls back to phone prefix when no locale', () => {
    const source = readFileSync(
      resolve('src/app/api/cron/send-maintenance-reminders/route.ts'),
      'utf-8'
    );
    // When locale is null/undefined, should fall back to phone detection
    expect(source).toContain('detectLanguageFromPhone(phone)');
  });
});

// ─── Bug 3: E2E data filtered from maintenance reminders ────────────────────

describe('Bug 3: E2E test data filtered from maintenance reminders cron', () => {
  it('filters out [E2E] prefixed client names', () => {
    const source = readFileSync(
      resolve('src/app/api/cron/send-maintenance-reminders/route.ts'),
      'utf-8'
    );

    // Should exclude bookings with E2E test client names
    expect(source).toContain(".not('client_name', 'ilike', '[E2E]%')");
  });

  it('filters out E2E space-prefixed client names', () => {
    const source = readFileSync(
      resolve('src/app/api/cron/send-maintenance-reminders/route.ts'),
      'utf-8'
    );

    // Also filters "E2E " prefix (without brackets)
    expect(source).toContain(".not('client_name', 'ilike', 'E2E %')");
  });

  it('filters are applied BEFORE the date check (in DB query)', () => {
    const source = readFileSync(
      resolve('src/app/api/cron/send-maintenance-reminders/route.ts'),
      'utf-8'
    );

    // The E2E filters should be in the same query chain as the other filters
    const queryBlock = source.slice(
      source.indexOf(".eq('status', 'completed')"),
      source.indexOf('if (bookingsError)')
    );
    expect(queryBlock).toContain("not('client_name', 'ilike', '[E2E]%')");
    expect(queryBlock).toContain("not('client_name', 'ilike', 'E2E %')");
  });
});

// ─── resolveLanguage unit tests ──────────────────────────────────────────────

describe('resolveLanguage logic (extracted from source)', () => {
  // Re-implement the function here for unit testing
  function detectLanguageFromPhone(phone: string): 'pt' | 'en' {
    const clean = phone.replace(/\D/g, '');
    if (
      phone.startsWith('+55') || phone.startsWith('+351') ||
      clean.startsWith('55') || clean.startsWith('351')
    ) return 'pt';
    return 'en';
  }

  function resolveLanguage(
    professionalLocale: string | null | undefined,
    phone: string
  ): 'pt' | 'en' {
    if (professionalLocale) {
      if (professionalLocale.startsWith('pt')) return 'pt';
      if (professionalLocale.startsWith('en')) return 'en';
      if (professionalLocale.startsWith('es')) return 'pt';
    }
    return detectLanguageFromPhone(phone);
  }

  it('returns pt for pt-BR locale regardless of phone', () => {
    expect(resolveLanguage('pt-BR', '+353851234567')).toBe('pt');
    expect(resolveLanguage('pt-BR', '+441234567890')).toBe('pt');
  });

  it('returns en for en-US locale regardless of phone', () => {
    expect(resolveLanguage('en-US', '+5511999999999')).toBe('en');
  });

  it('returns pt for es-ES locale (closest template)', () => {
    expect(resolveLanguage('es-ES', '+34612345678')).toBe('pt');
  });

  it('falls back to phone prefix when locale is null', () => {
    expect(resolveLanguage(null, '+5511999999999')).toBe('pt');
    expect(resolveLanguage(null, '+353851234567')).toBe('en');
  });

  it('falls back to phone prefix when locale is undefined', () => {
    expect(resolveLanguage(undefined, '+351912345678')).toBe('pt');
    expect(resolveLanguage(undefined, '+442071234567')).toBe('en');
  });

  it('handles Brazilian phone without + prefix', () => {
    expect(resolveLanguage(null, '5511999999999')).toBe('pt');
  });

  it('handles Portuguese phone without + prefix', () => {
    expect(resolveLanguage(null, '351912345678')).toBe('pt');
  });
});
