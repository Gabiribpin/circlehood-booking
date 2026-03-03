import { describe, it, expect } from 'vitest';
import { readdirSync } from 'fs';
import { join } from 'path';

const MIGRATIONS_DIR = join(process.cwd(), 'supabase/migrations');

describe('Migration timestamps — unique and sequential (#28)', () => {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  it('all migration files have unique timestamps (no duplicates)', () => {
    const timestamps = files.map((f) => f.split('_')[0]);
    const duplicates = timestamps.filter(
      (ts, i) => timestamps.indexOf(ts) !== i
    );
    const uniqueDuplicates = [...new Set(duplicates)];

    expect(uniqueDuplicates).toEqual([]);
  });

  it('sprint8 fase2 migrations are in correct sequential order', () => {
    const sprint8Fase2 = files.filter(
      (f) => f.startsWith('20250218') && f !== '20250218000000_sprint8_integrations.sql'
    );

    expect(sprint8Fase2).toEqual([
      '20250218000001_sprint8_fase2_CLEANUP.sql',
      '20250218000002_sprint8_fase2_integrations.sql',
      '20250218000003_INTEGRATIONS_TABLE.sql',
      '20250218000004_DROP_AND_CREATE_INTEGRATIONS.sql',
      '20250218000005_FIX_INSTAGRAM.sql',
      '20250218000006_RESTO.sql',
    ]);
  });

  it('CLEANUP runs before integrations (dependency order)', () => {
    const cleanupIdx = files.findIndex((f) => f.includes('CLEANUP'));
    const integrationsIdx = files.findIndex((f) =>
      f.includes('sprint8_fase2_integrations')
    );
    expect(cleanupIdx).toBeLessThan(integrationsIdx);
  });

  it('FIX_INSTAGRAM runs after INTEGRATIONS_TABLE (depends on integrations)', () => {
    const integrationsTableIdx = files.findIndex((f) =>
      f.includes('INTEGRATIONS_TABLE')
    );
    const fixInstagramIdx = files.findIndex((f) =>
      f.includes('FIX_INSTAGRAM')
    );
    expect(integrationsTableIdx).toBeLessThan(fixInstagramIdx);
  });

  it('total migration count matches expected', () => {
    expect(files.length).toBeGreaterThan(0);
    // Ensure we didn't accidentally delete any migrations
    expect(files.length).toBeGreaterThanOrEqual(50);
  });
});
