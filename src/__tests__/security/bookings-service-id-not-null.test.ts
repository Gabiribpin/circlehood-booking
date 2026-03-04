import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const MIGRATION_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  'supabase',
  'migrations',
  '20260304000007_bookings_service_id_not_null.sql'
);

describe('bookings.service_id NOT NULL constraint (#111)', () => {
  it('migration file exists', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
  });

  describe('migration content', () => {
    const migration = readFileSync(MIGRATION_PATH, 'utf-8');

    it('cleans up orphaned rows with NULL service_id first', () => {
      const deleteIndex = migration.indexOf('DELETE FROM bookings WHERE service_id IS NULL');
      const alterIndex = migration.indexOf('ALTER TABLE bookings');
      expect(deleteIndex).toBeGreaterThan(-1);
      expect(alterIndex).toBeGreaterThan(deleteIndex);
    });

    it('adds NOT NULL constraint to service_id', () => {
      expect(migration).toContain('ALTER TABLE bookings ALTER COLUMN service_id SET NOT NULL');
    });
  });
});
