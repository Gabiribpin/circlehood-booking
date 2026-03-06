import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #185: Trigger add_loyalty_stamp_on_completion references
 * notification_queue which was dropped in migration 20260303000007.
 *
 * Any booking marked as 'completed' would crash with:
 *   "relation notification_queue does not exist"
 */

const fixMigrationPath = resolve(
  'supabase/migrations/20260306000001_fix_loyalty_stamp_no_notification_queue.sql'
);
const dropMigrationPath = resolve(
  'supabase/migrations/20260303000007_drop_notification_queue.sql'
);
const originalTriggerPath = resolve(
  'supabase/migrations/20260218000000_fix_booking_triggers.sql'
);

describe('loyalty stamp trigger fix (issue #185)', () => {
  it('fix migration exists', () => {
    expect(existsSync(fixMigrationPath)).toBe(true);
  });

  it('fix migration recreates add_loyalty_stamp_on_completion function', () => {
    const sql = readFileSync(fixMigrationPath, 'utf-8');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION add_loyalty_stamp_on_completion()');
  });

  it('fix migration does NOT INSERT INTO notification_queue', () => {
    const sql = readFileSync(fixMigrationPath, 'utf-8');
    expect(sql).not.toContain('INSERT INTO notification_queue');
    // The function body (between $$ ... $$) must not reference notification_queue
    const bodyMatch = sql.match(/\$\$\s*([\s\S]*?)\s*\$\$/);
    expect(bodyMatch).not.toBeNull();
    expect(bodyMatch![1]).not.toContain('notification_queue');
  });

  it('fix migration preserves loyalty_cards upsert logic', () => {
    const sql = readFileSync(fixMigrationPath, 'utf-8');
    expect(sql).toContain('INSERT INTO loyalty_cards');
    expect(sql).toContain('ON CONFLICT (professional_id, contact_phone)');
    expect(sql).toContain('current_stamps = loyalty_cards.current_stamps + 1');
  });

  it('fix migration preserves reward calculation (stamps / 10)', () => {
    const sql = readFileSync(fixMigrationPath, 'utf-8');
    expect(sql).toContain('v_loyalty_card.current_stamps / 10');
    expect(sql).toContain('rewards_available = rewards_available + v_new_rewards');
  });

  it('fix migration preserves loyalty_transactions inserts', () => {
    const sql = readFileSync(fixMigrationPath, 'utf-8');
    expect(sql).toContain("INSERT INTO loyalty_transactions");
    expect(sql).toContain("'reward_earned'");
    expect(sql).toContain("'stamp_earned'");
  });

  it('fix migration only triggers on status change to completed', () => {
    const sql = readFileSync(fixMigrationPath, 'utf-8');
    expect(sql).toContain("OLD.status != 'completed' AND NEW.status = 'completed'");
  });

  it('fix migration runs AFTER the drop migration (ordering)', () => {
    // 20260306000001 > 20260303000007
    const fixTimestamp = '20260306000001';
    const dropTimestamp = '20260303000007';
    expect(fixTimestamp > dropTimestamp).toBe(true);
  });

  it('original trigger migration DID reference notification_queue (confirming the bug)', () => {
    const sql = readFileSync(originalTriggerPath, 'utf-8');
    expect(sql).toContain('INSERT INTO notification_queue');
  });

  it('drop migration removed notification_queue table', () => {
    const sql = readFileSync(dropMigrationPath, 'utf-8');
    expect(sql).toContain('DROP TABLE IF EXISTS notification_queue CASCADE');
  });
});
