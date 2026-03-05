import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #208: Drop broken views email_campaign_performance
 * and instagram_performance that reference non-existent columns
 * (professionals.name, professionals.email, professionals.instagram_handle).
 */

describe('Broken views dropped (issue #208)', () => {
  const migrationPath = 'supabase/migrations/20260305000001_drop_broken_views.sql';

  it('migration file exists', () => {
    expect(existsSync(resolve(migrationPath))).toBe(true);
  });

  it('drops email_campaign_performance view', () => {
    const source = readFileSync(resolve(migrationPath), 'utf-8');
    expect(source).toContain('DROP VIEW IF EXISTS email_campaign_performance');
  });

  it('drops instagram_performance view', () => {
    const source = readFileSync(resolve(migrationPath), 'utf-8');
    expect(source).toContain('DROP VIEW IF EXISTS instagram_performance');
  });

  it('uses CASCADE to handle dependencies', () => {
    const source = readFileSync(resolve(migrationPath), 'utf-8');
    expect(source).toContain('CASCADE');
  });

  it('views are not referenced in application code (excluding tests)', () => {
    const { execSync } = require('child_process');
    const result = execSync(
      'grep -rl "email_campaign_performance\\|instagram_performance" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v __tests__ || true',
      { encoding: 'utf-8' }
    );
    expect(result.trim()).toBe('');
  });

  it('original view definition referenced non-existent columns', () => {
    // The original migration that created these views
    const original = readFileSync(
      resolve('supabase/migrations/20250218000002_sprint8_fase2_integrations.sql'),
      'utf-8'
    );
    // These columns don't exist in professionals table
    expect(original).toContain('p.name as professional_name');
    expect(original).toContain('p.email as professional_email');
    expect(original).toContain('p.instagram_handle');
  });

  it('professionals table uses business_name not name', () => {
    const init = readFileSync(
      resolve('supabase/migrations/20250101000000_init.sql'),
      'utf-8'
    );
    // Extract only the professionals table definition
    const profStart = init.indexOf('CREATE TABLE professionals');
    const profEnd = init.indexOf(');', profStart);
    const profDef = init.slice(profStart, profEnd);
    expect(profDef).toContain('business_name VARCHAR');
    // professionals has no standalone 'name' column
    expect(profDef).not.toMatch(/^\s+name\s+VARCHAR/m);
  });
});
