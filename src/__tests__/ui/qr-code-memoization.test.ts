import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Tests for Issue #152: QR code generated without memoization
 *
 * QRCode.toDataURL() was called inside the data fetch effect without
 * dependency tracking. Now it runs in a separate useEffect keyed on
 * landingUrl, and handleDownloadQR is wrapped in useCallback.
 */

describe('QR code memoization in next-steps-card (issue #152)', () => {
  const source = readFileSync(
    resolve('src/components/dashboard/next-steps-card.tsx'),
    'utf-8',
  );

  it('QR code generation is in a separate useEffect with landingUrl dependency', () => {
    // Should have useEffect with [landingUrl] for QR code
    expect(source).toContain('[landingUrl]');
    // The QR generation should be in this effect, not in the fetch effect
    const qrEffectMatch = source.match(/useEffect\(\(\) => \{[\s\S]*?QRCode\.toDataURL[\s\S]*?\[landingUrl\]/);
    expect(qrEffectMatch).not.toBeNull();
  });

  it('QR code is not generated in the data fetch effect', () => {
    // The fetchData function should NOT contain QRCode.toDataURL
    const fetchSection = source.slice(
      source.indexOf('async function fetchData'),
      source.indexOf('fetchData();'),
    );
    expect(fetchSection).not.toContain('QRCode.toDataURL');
  });

  it('handleDownloadQR is wrapped in useCallback', () => {
    expect(source).toContain('useCallback');
    expect(source).toContain('const handleDownloadQR = useCallback');
  });

  it('useCallback has proper dependencies', () => {
    // Should depend on qrCodeUrl, businessName, slug
    const callbackSection = source.slice(
      source.indexOf('const handleDownloadQR = useCallback'),
      source.indexOf('const handleDownloadQR = useCallback') + 1500,
    );
    expect(callbackSection).toContain('qrCodeUrl');
    expect(callbackSection).toContain('businessName');
    expect(callbackSection).toContain('slug');
  });

  it('QR effect has cleanup to prevent stale updates', () => {
    expect(source).toContain('cancelled');
  });
});
