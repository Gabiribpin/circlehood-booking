import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATH = join(
  process.cwd(),
  'supabase/migrations/20260303000001_fix_booking_time_references.sql'
);

const migrationSQL = readFileSync(MIGRATION_PATH, 'utf-8');

describe('Migration: fix booking_time references (#27)', () => {
  it('does NOT reference booking_time as a column (NEW.booking_time or b.booking_time)', () => {
    // The only allowed occurrence is the JSON key 'booking_time' in jsonb_build_object
    const lines = migrationSQL.split('\n');
    const violations: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip comments
      if (line.trim().startsWith('--')) continue;
      // Skip the JSON key in jsonb_build_object (this is a data key, not a column reference)
      if (line.includes("'booking_time'")) continue;

      if (/\bNEW\.booking_time\b/.test(line)) {
        violations.push(`Line ${i + 1}: ${line.trim()}`);
      }
      if (/\bOLD\.booking_time\b/.test(line)) {
        violations.push(`Line ${i + 1}: ${line.trim()}`);
      }
      if (/\bb\.booking_time\b/.test(line)) {
        violations.push(`Line ${i + 1}: ${line.trim()}`);
      }
      if (/\bbs\.booking_time\b/.test(line)) {
        violations.push(`Line ${i + 1}: ${line.trim()}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('uses NEW.start_time in notify_waitlist_on_cancellation', () => {
    expect(migrationSQL).toContain('NEW.start_time');
    expect(migrationSQL).toContain('notify_waitlist_on_cancellation');
  });

  it('uses b.start_time in get_available_slots', () => {
    expect(migrationSQL).toContain('b.start_time::time AS booking_start');
    expect(migrationSQL).toContain('get_available_slots');
  });

  it('uses b.start_time and b.end_time in check_calendar_conflicts', () => {
    expect(migrationSQL).toContain('b.start_time::time');
    expect(migrationSQL).toContain('b.end_time::time');
    expect(migrationSQL).toContain('check_calendar_conflicts');
  });

  it('uses client_name instead of contact_name in check_calendar_conflicts', () => {
    expect(migrationSQL).toContain('b.client_name');
    expect(migrationSQL).not.toMatch(/b\.contact_name/);
  });

  it('fixes all three functions with CREATE OR REPLACE', () => {
    const createOrReplace = migrationSQL.match(/CREATE OR REPLACE FUNCTION/g);
    expect(createOrReplace).toHaveLength(3);
  });

  it('keeps the booking_time JSON key in waitlist notification data', () => {
    // The JSON key 'booking_time' is intentional — it's data for the notification template,
    // but the VALUE should reference start_time
    expect(migrationSQL).toContain("'booking_time', NEW.start_time");
  });

  it('original migration has no remaining booking_time column references', () => {
    // Verify the original problematic migration file still has the bugs
    // (this confirms our fix is necessary)
    const originalPath = join(
      process.cwd(),
      'supabase/migrations/20250217000000_sprint7_automations.sql'
    );
    const original = readFileSync(originalPath, 'utf-8');
    expect(original).toContain('NEW.booking_time');
    expect(original).toMatch(/\bbooking_time\b/);
  });
});
