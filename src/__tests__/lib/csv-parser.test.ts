import { describe, it, expect } from 'vitest';
import { parseCSVLine } from '@/lib/csv-parser';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('parseCSVLine (issue #135)', () => {
  it('parses simple comma-separated fields', () => {
    expect(parseCSVLine('John,john@test.com,+351900000000,notes'))
      .toEqual(['John', 'john@test.com', '+351900000000', 'notes']);
  });

  it('handles quoted fields with commas inside', () => {
    expect(parseCSVLine('"Smith, John",john@test.com,+351900000000,notes'))
      .toEqual(['Smith, John', 'john@test.com', '+351900000000', 'notes']);
  });

  it('handles escaped quotes inside quoted fields', () => {
    expect(parseCSVLine('"She said ""hello""",test@test.com,,'))
      .toEqual(['She said "hello"', 'test@test.com', '', '']);
  });

  it('handles empty fields', () => {
    expect(parseCSVLine('John,,,'))
      .toEqual(['John', '', '', '']);
  });

  it('handles single field', () => {
    expect(parseCSVLine('John'))
      .toEqual(['John']);
  });

  it('handles quoted field with newline-like content', () => {
    expect(parseCSVLine('"line1 line2",email@test.com,,'))
      .toEqual(['line1 line2', 'email@test.com', '', '']);
  });

  it('handles mixed quoted and unquoted fields', () => {
    expect(parseCSVLine('John,"Smith, Jr.",+351900000000,"VIP, special"'))
      .toEqual(['John', 'Smith, Jr.', '+351900000000', 'VIP, special']);
  });

  it('handles empty string', () => {
    expect(parseCSVLine('')).toEqual(['']);
  });

  it('handles all quoted fields', () => {
    expect(parseCSVLine('"a","b","c","d"'))
      .toEqual(['a', 'b', 'c', 'd']);
  });

  it('handles quotes at field boundaries only', () => {
    expect(parseCSVLine('"hello",world'))
      .toEqual(['hello', 'world']);
  });
});

describe('contacts/import route uses parseCSVLine (issue #135)', () => {
  it('imports parseCSVLine instead of using naive split', () => {
    const source = readFileSync(
      resolve('src/app/api/contacts/import/route.ts'),
      'utf-8'
    );
    expect(source).toContain('parseCSVLine');
    expect(source).not.toContain("line.split(',')");
  });
});
