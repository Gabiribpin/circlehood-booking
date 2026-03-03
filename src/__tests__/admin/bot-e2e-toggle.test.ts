import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #84: Bot E2E toggle shows "GH_ACTIONS_TOKEN not configured"
 *
 * The bot-e2e-toggle API needs GH_ACTIONS_TOKEN to manage the BOT_E2E_ENABLED
 * GitHub Actions variable. The error message should clearly explain what's needed.
 */

describe('bot-e2e-toggle route (issue #84)', () => {
  const source = readFileSync(
    resolve('src/app/api/admin/bot-e2e-toggle/route.ts'),
    'utf-8'
  );

  it('checks for GH_ACTIONS_TOKEN env var', () => {
    expect(source).toContain('process.env.GH_ACTIONS_TOKEN');
  });

  it('returns descriptive error when GH_ACTIONS_TOKEN is missing (GET)', () => {
    // Should explain what token is needed and where to add it
    expect(source).toContain('GitHub PAT');
    expect(source).toContain('Vercel');
  });

  it('returns descriptive error when GH_ACTIONS_TOKEN is missing (PATCH)', () => {
    // Both GET and PATCH should have helpful error messages
    const patchSection = source.slice(source.indexOf('export async function PATCH'));
    expect(patchSection).toContain('GH_ACTIONS_TOKEN');
    expect(patchSection).toContain('GitHub PAT');
  });

  it('requires admin authentication on GET', () => {
    expect(source).toContain('validateAdminToken');
    expect(source).toContain("status: 401");
  });

  it('requires admin authentication on PATCH', () => {
    const patchSection = source.slice(source.indexOf('export async function PATCH'));
    expect(patchSection).toContain('validateAdminToken');
    expect(patchSection).toContain("status: 401");
  });

  it('manages BOT_E2E_ENABLED GitHub Actions variable', () => {
    expect(source).toContain("'BOT_E2E_ENABLED'");
    expect(source).toContain('actions/variables');
  });

  it('handles variable creation when it does not exist (404)', () => {
    expect(source).toContain('res.status === 404');
    expect(source).toContain("method: 'POST'");
  });
});

describe('execution-wheel page — Bot E2E section', () => {
  const source = readFileSync(
    resolve('src/app/[locale]/(admin)/admin/execution-wheel/page.tsx'),
    'utf-8'
  );

  it('shows Bot E2E toggle in the UI', () => {
    expect(source).toContain('Bot E2E (Anthropic)');
  });

  it('explains what the toggle does', () => {
    expect(source).toContain('BOT_E2E_ENABLED');
  });

  it('shows error message from API when token is missing', () => {
    expect(source).toContain('botE2eError');
  });

  it('disables toggle when there is an error', () => {
    expect(source).toContain('disabled={botE2eLoading || !!botE2eError}');
  });
});
