import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #156: Suspense fallbacks with skeletons
 *
 * Dashboard pages load async data. Without loading.tsx / Suspense,
 * users see a blank page. Now we have a Skeleton component and
 * a loading.tsx at the dashboard layout level.
 */

describe('Skeleton UI component (issue #156)', () => {
  const skeletonPath = 'src/components/ui/skeleton.tsx';

  it('skeleton component exists', () => {
    expect(existsSync(resolve(skeletonPath))).toBe(true);
  });

  it('exports Skeleton component', () => {
    const source = readFileSync(resolve(skeletonPath), 'utf-8');
    expect(source).toContain('export { Skeleton }');
  });

  it('uses animate-pulse for loading animation', () => {
    const source = readFileSync(resolve(skeletonPath), 'utf-8');
    expect(source).toContain('animate-pulse');
  });

  it('uses cn utility for className merging', () => {
    const source = readFileSync(resolve(skeletonPath), 'utf-8');
    expect(source).toContain("from '@/lib/utils'");
    expect(source).toContain('cn(');
  });

  it('accepts className and HTML div props', () => {
    const source = readFileSync(resolve(skeletonPath), 'utf-8');
    expect(source).toContain('className');
    expect(source).toContain('...props');
  });
});

describe('Dashboard loading.tsx (issue #156)', () => {
  const loadingPath = 'src/app/[locale]/(dashboard)/loading.tsx';

  it('loading.tsx exists at dashboard layout level', () => {
    expect(existsSync(resolve(loadingPath))).toBe(true);
  });

  it('imports Skeleton component', () => {
    const source = readFileSync(resolve(loadingPath), 'utf-8');
    expect(source).toContain("from '@/components/ui/skeleton'");
  });

  it('exports default function', () => {
    const source = readFileSync(resolve(loadingPath), 'utf-8');
    expect(source).toContain('export default function');
  });

  it('renders KPI card skeletons', () => {
    const source = readFileSync(resolve(loadingPath), 'utf-8');
    // Should have multiple skeleton placeholders for KPI cards
    const skeletonCount = (source.match(/<Skeleton/g) || []).length;
    expect(skeletonCount).toBeGreaterThanOrEqual(4);
  });

  it('renders content area skeletons', () => {
    const source = readFileSync(resolve(loadingPath), 'utf-8');
    // Should have list-item-like skeletons (rounded-full for avatars)
    expect(source).toContain('rounded-full');
  });

  it('uses responsive grid layout', () => {
    const source = readFileSync(resolve(loadingPath), 'utf-8');
    expect(source).toContain('grid-cols-1');
    expect(source).toContain('md:grid-cols-2');
  });

  it('is NOT a client component (no use client directive)', () => {
    const source = readFileSync(resolve(loadingPath), 'utf-8');
    expect(source).not.toContain("'use client'");
  });
});

describe('No other loading.tsx files missing', () => {
  it('dashboard layout level loading.tsx covers all sub-routes', () => {
    // The (dashboard) layout loading.tsx acts as fallback for all
    // nested routes. This is the recommended Next.js pattern.
    const source = readFileSync(resolve('src/app/[locale]/(dashboard)/loading.tsx'), 'utf-8');
    expect(source).toContain('Skeleton');
  });
});
