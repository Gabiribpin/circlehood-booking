import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

/**
 * Guard test: ensures no raw console.log/error/warn calls in production code.
 * All logging should go through src/lib/logger.ts which suppresses debug
 * logs in production to prevent sensitive data leakage.
 *
 * Exclusions:
 * - src/lib/logger.ts (the logger itself uses console internally)
 * - __tests__/ (test files can use console freely)
 */

describe('No console statements in production code (issue #38)', () => {
  const result = execSync(
    "grep -rn 'console\\.\\(log\\|error\\|warn\\)(' src/ --include='*.ts' --include='*.tsx' | grep -v __tests__ | grep -v 'src/lib/logger.ts' || true",
    { encoding: 'utf-8' },
  ).trim();

  it('has zero console.log/error/warn calls in src/ (excluding logger.ts and tests)', () => {
    if (result) {
      const lines = result.split('\n');
      const summary = lines.slice(0, 10).join('\n');
      expect.fail(
        `Found ${lines.length} console statement(s) in production code. Use logger from '@/lib/logger' instead:\n${summary}`,
      );
    }
    expect(result).toBe('');
  });

  it('logger.ts exists and exports logger object', () => {
    const fs = require('fs');
    const path = require('path');
    const loggerSource = fs.readFileSync(
      path.resolve('src/lib/logger.ts'),
      'utf-8',
    );
    expect(loggerSource).toContain('export const logger');
    expect(loggerSource).toContain("process.env.NODE_ENV === 'production'");
  });

  it('logger suppresses info/log in production', () => {
    const fs = require('fs');
    const path = require('path');
    const loggerSource = fs.readFileSync(
      path.resolve('src/lib/logger.ts'),
      'utf-8',
    );
    expect(loggerSource).toContain('noop');
    expect(loggerSource).toContain('isProduction ? noop');
  });
});
