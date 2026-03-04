import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..', '..');

describe('No-Show Metrics — Integration', () => {
  it('migration file exists with no_show_at column', () => {
    const migrationPath = join(ROOT, 'supabase/migrations/20260304000001_add_no_show_fields.sql');
    expect(existsSync(migrationPath)).toBe(true);
    const content = readFileSync(migrationPath, 'utf-8');
    expect(content).toContain('no_show_at');
    expect(content).toContain('TIMESTAMPTZ');
  });

  it('bookings-manager has no-show button and tab', () => {
    const filePath = join(ROOT, 'src/components/dashboard/bookings-manager.tsx');
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain("markNoShow");
    expect(content).toContain("tabNoShow");
    expect(content).toContain("no_show_at");
    expect(content).toContain("'no_show'");
  });

  it('analytics overview route returns noShowCount and noShowRate', () => {
    const filePath = join(ROOT, 'src/app/api/analytics/overview/route.ts');
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('noShowCount');
    expect(content).toContain('noShowRate');
  });

  it('export-csv includes no-show metrics', () => {
    const filePath = join(ROOT, 'src/lib/analytics/export-csv.ts');
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('No-Show Bookings');
    expect(content).toContain('No-Show Rate');
  });

  it('translations include no-show keys in all 3 locales', () => {
    for (const locale of ['pt-BR', 'en-US', 'es-ES']) {
      const filePath = join(ROOT, `messages/${locale}.json`);
      const content = readFileSync(filePath, 'utf-8');
      const json = JSON.parse(content);

      expect(json.bookings.markNoShow).toBeTruthy();
      expect(json.bookings.tabNoShow).toBeTruthy();
      expect(json.bookings.noShowOn).toBeTruthy();
      expect(json.analytics.noShowCard).toBeTruthy();
      expect(json.analytics.noShowRate).toBeTruthy();
    }
  });

  it('analytics dashboard has no-show KPI card', () => {
    const filePath = join(ROOT, 'src/app/[locale]/(dashboard)/analytics/analytics-dashboard.tsx');
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('noShowCard');
    expect(content).toContain('noShowRate');
    expect(content).toContain('UserX');
  });
});
