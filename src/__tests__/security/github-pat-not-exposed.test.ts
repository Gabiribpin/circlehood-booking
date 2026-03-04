import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const PAGE_PATH = join(
  __dirname,
  '..',
  '..',
  'app',
  '[locale]',
  '(admin)',
  'admin',
  'execution-wheel',
  'page.tsx'
);

const PROXY_PATH = join(
  __dirname,
  '..',
  '..',
  'app',
  'api',
  'admin',
  'github',
  'issues',
  'route.ts'
);

const ENV_EXAMPLE_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  '.env.example'
);

describe('GitHub PAT not exposed to client (#133)', () => {
  const page = readFileSync(PAGE_PATH, 'utf-8');
  const proxy = readFileSync(PROXY_PATH, 'utf-8');
  const envExample = readFileSync(ENV_EXAMPLE_PATH, 'utf-8');

  it('page does NOT reference NEXT_PUBLIC_GH_ISSUES_PAT', () => {
    expect(page).not.toContain('NEXT_PUBLIC_GH_ISSUES_PAT');
  });

  it('page does NOT reference any NEXT_PUBLIC_GH_ env var', () => {
    expect(page).not.toMatch(/process\.env\.NEXT_PUBLIC_GH_/);
  });

  it('.env.example does NOT have NEXT_PUBLIC_GH_ISSUES_PAT', () => {
    expect(envExample).not.toContain('NEXT_PUBLIC_GH_ISSUES_PAT');
  });

  it('.env.example has server-only GH_PAT_ADMIN', () => {
    expect(envExample).toContain('GH_PAT_ADMIN=');
  });

  it('proxy route validates admin auth', () => {
    expect(proxy).toContain('validateAdminToken');
    expect(proxy).toContain('Unauthorized');
  });

  it('proxy route uses server-side GH_PAT_ADMIN', () => {
    expect(proxy).toContain('GH_PAT_ADMIN');
  });

  it('proxy supports check action', () => {
    expect(proxy).toContain("action === 'check'");
  });

  it('proxy supports PATCH for closing issues', () => {
    expect(proxy).toContain('export async function PATCH');
    expect(proxy).toContain("state: state || 'closed'");
  });

  it('proxy supports comment action', () => {
    expect(proxy).toContain("action === 'comment'");
  });

  it('page uses proxyFetch for server-side token', () => {
    expect(page).toContain('proxyFetch');
    expect(page).toContain("token === 'proxy'");
  });
});
