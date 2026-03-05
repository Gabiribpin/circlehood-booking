import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #153: Alt text genérico em before/after slider
 *
 * The public before-after-slider had hardcoded alt="Before"/"After".
 * Now accepts beforeLabel/afterLabel props for descriptive alt text.
 */

describe('Before/after slider alt text (issue #153)', () => {
  const source = readFileSync(
    resolve('src/components/public-page/before-after-slider.tsx'),
    'utf-8',
  );

  it('accepts beforeLabel prop', () => {
    expect(source).toContain('beforeLabel');
  });

  it('accepts afterLabel prop', () => {
    expect(source).toContain('afterLabel');
  });

  it('has default values for labels', () => {
    expect(source).toContain("beforeLabel = 'Antes'");
    expect(source).toContain("afterLabel = 'Depois'");
  });

  it('uses beforeLabel for before image alt text', () => {
    expect(source).toContain('alt={beforeLabel}');
  });

  it('uses afterLabel for after image alt text', () => {
    expect(source).toContain('alt={afterLabel}');
  });

  it('does not have hardcoded alt="Before" or alt="After"', () => {
    expect(source).not.toContain('alt="Before"');
    expect(source).not.toContain('alt="After"');
  });

  it('does not have hardcoded label text in JSX', () => {
    // Labels should use the props, not hardcoded strings
    const lines = source.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === 'Antes' || trimmed === 'Depois') {
        expect.fail(`Found hardcoded label "${trimmed}"`);
      }
    }
  });

  it('props are defined in the interface', () => {
    const interfaceStart = source.indexOf('interface BeforeAfterSliderProps');
    const interfaceEnd = source.indexOf('}', interfaceStart);
    const interfaceSection = source.slice(interfaceStart, interfaceEnd + 1);
    expect(interfaceSection).toContain('beforeLabel');
    expect(interfaceSection).toContain('afterLabel');
  });
});
