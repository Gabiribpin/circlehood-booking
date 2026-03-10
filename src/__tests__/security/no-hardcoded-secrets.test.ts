import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const HANDBOOK_DIR = path.resolve(
  __dirname,
  '../../app/[locale]/(admin)/admin/handbook',
);

const FIX_TRIGGERS_PATH = path.resolve(
  __dirname,
  '../../app/api/admin/fix-triggers/route.ts',
);

/** Patterns that must NEVER appear in source code */
const FORBIDDEN_PATTERNS = [
  { pattern: /ibkkxykcrwhncvqxzynt/, label: 'Supabase project ref' },
  {
    pattern: /redis-15673\.c226\.eu-west-1-3\.ec2\.cloud\.redislabs\.com/,
    label: 'Redis hostname',
  },
  { pattern: /re_iebgvquj/, label: 'Resend API key prefix' },
  { pattern: /pk_test_51[A-Za-z0-9]{10,}/, label: 'Stripe publishable key (real)' },
  { pattern: /sk_test_51[A-Za-z0-9]{10,}/, label: 'Stripe secret key (real)' },
  { pattern: /whsec_[A-Za-z0-9]{20,}/, label: 'Stripe webhook secret (real)' },
];

function readFileContent(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

function getHandbookFiles(): string[] {
  const files: string[] = [];
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))
        files.push(full);
    }
  }
  walk(HANDBOOK_DIR);
  return files;
}

describe('No hardcoded secrets in admin handbook', () => {
  const handbookFiles = getHandbookFiles();

  for (const file of handbookFiles) {
    const relPath = path.relative(process.cwd(), file);
    const content = readFileContent(file);

    for (const { pattern, label } of FORBIDDEN_PATTERNS) {
      it(`${relPath} must not contain ${label}`, () => {
        expect(content).not.toMatch(pattern);
      });
    }
  }
});

describe('No hardcoded secrets in fix-triggers route', () => {
  const content = readFileContent(FIX_TRIGGERS_PATH);

  for (const { pattern, label } of FORBIDDEN_PATTERNS) {
    it(`fix-triggers/route.ts must not contain ${label}`, () => {
      expect(content).not.toMatch(pattern);
    });
  }

  it('should derive projectRef from NEXT_PUBLIC_SUPABASE_URL env var', () => {
    expect(content).toContain('process.env.NEXT_PUBLIC_SUPABASE_URL');
  });
});
