import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('Payments Health Dashboard (issue #22)', () => {
  const pagePath = 'src/app/[locale]/(admin)/admin/payments-health/page.tsx';
  const chartPath = 'src/components/admin/payments-health-chart.tsx';
  const layoutPath = 'src/app/[locale]/(admin)/layout.tsx';

  it('page file exists at correct path', () => {
    expect(existsSync(resolve(pagePath))).toBe(true);
  });

  it('chart component exists at correct path', () => {
    expect(existsSync(resolve(chartPath))).toBe(true);
  });

  it('chart component is a client component', () => {
    const source = readFileSync(resolve(chartPath), 'utf-8');
    expect(source.startsWith("'use client'")).toBe(true);
  });

  it('chart component exports PaymentsHealthChart', () => {
    const source = readFileSync(resolve(chartPath), 'utf-8');
    expect(source).toContain('export function PaymentsHealthChart');
  });

  it('chart uses ComposedChart with ResponsiveContainer', () => {
    const source = readFileSync(resolve(chartPath), 'utf-8');
    expect(source).toContain('ComposedChart');
    expect(source).toContain('ResponsiveContainer');
    expect(source).toContain('height={300}');
  });

  describe('page queries', () => {
    const source = readFileSync(resolve(pagePath), 'utf-8');

    it('uses createAdminClient for server-side queries', () => {
      expect(source).toContain('createAdminClient');
    });

    it('queries pending_payment bookings', () => {
      expect(source).toContain("'pending_payment'");
    });

    it('queries succeeded payments', () => {
      expect(source).toContain("'succeeded'");
    });

    it('queries failed payments', () => {
      expect(source).toContain("'failed'");
    });

    it('queries refunded payments', () => {
      expect(source).toContain("'refunded'");
    });

    it('uses Promise.allSettled for parallel queries', () => {
      expect(source).toContain('Promise.allSettled');
    });

    it('imports the chart component', () => {
      expect(source).toContain('PaymentsHealthChart');
    });
  });

  describe('admin layout nav', () => {
    const layoutSource = readFileSync(resolve(layoutPath), 'utf-8');

    it('has nav link to payments-health', () => {
      expect(layoutSource).toContain('/admin/payments-health');
    });

    it('uses Activity icon for the nav link', () => {
      expect(layoutSource).toContain('Activity');
    });

    it('payments-health link appears after Recebimentos', () => {
      const recebimentosIdx = layoutSource.indexOf('Recebimentos');
      const healthIdx = layoutSource.indexOf('payments-health');
      expect(recebimentosIdx).toBeGreaterThan(-1);
      expect(healthIdx).toBeGreaterThan(recebimentosIdx);
    });
  });

  describe('payments migration', () => {
    const migrationPath = 'supabase/migrations/20260223000002_payments_table.sql';

    it('payments table migration exists', () => {
      expect(existsSync(resolve(migrationPath))).toBe(true);
    });

    it('payments table has required columns', () => {
      const sql = readFileSync(resolve(migrationPath), 'utf-8');
      expect(sql).toContain('status');
      expect(sql).toContain('amount');
      expect(sql).toContain('created_at');
      expect(sql).toContain('booking_id');
      expect(sql).toContain('currency');
    });
  });
});
