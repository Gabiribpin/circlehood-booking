import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('bookings.service_id NOT NULL constraint', () => {
  const migrationDir = path.resolve('supabase/migrations');

  it('migration adds NOT NULL constraint to service_id', () => {
    const sql = fs.readFileSync(
      path.join(migrationDir, '20260303000007_bookings_service_id_not_null.sql'),
      'utf-8'
    );

    expect(sql).toContain('ALTER TABLE bookings ALTER COLUMN service_id SET NOT NULL');
  });

  it('migration cleans up NULL service_id rows before adding constraint', () => {
    const sql = fs.readFileSync(
      path.join(migrationDir, '20260303000007_bookings_service_id_not_null.sql'),
      'utf-8'
    );

    // DELETE must come BEFORE ALTER to avoid constraint violation
    const deleteIdx = sql.indexOf('DELETE FROM bookings WHERE service_id IS NULL');
    const alterIdx = sql.indexOf('ALTER TABLE bookings ALTER COLUMN service_id SET NOT NULL');

    expect(deleteIdx).toBeGreaterThan(-1);
    expect(alterIdx).toBeGreaterThan(-1);
    expect(deleteIdx).toBeLessThan(alterIdx);
  });

  it('original init migration has service_id without NOT NULL', () => {
    const initSql = fs.readFileSync(
      path.join(migrationDir, '20250101000000_init.sql'),
      'utf-8'
    );

    // Confirm the bug: service_id FK without NOT NULL
    const match = initSql.match(/service_id\s+UUID\s+REFERENCES\s+services\(id\)/);
    expect(match).toBeTruthy();

    // Should NOT have NOT NULL on the same line
    const line = initSql.split('\n').find(l => l.includes('service_id') && l.includes('REFERENCES services'));
    expect(line).toBeDefined();
    expect(line).not.toMatch(/NOT\s+NULL/i);
  });
});
