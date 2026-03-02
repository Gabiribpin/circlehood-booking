import { describe, it, expect } from 'vitest';
import { maskSensitiveHeaders } from '../mask-headers';

describe('maskSensitiveHeaders', () => {
  it('masks apikey header (> 8 chars)', () => {
    const headers = new Headers({ apikey: 'super-secret-key-12345' });
    const result = maskSensitiveHeaders(headers);
    expect(result['apikey']).toBe('super-se***');
  });

  it('masks x-webhook-secret header', () => {
    const headers = new Headers({ 'x-webhook-secret': 'very-long-secret-key-123456789' });
    const result = maskSensitiveHeaders(headers);
    expect(result['x-webhook-secret']).toBe('very-lon***');
  });

  it('masks authorization header', () => {
    const headers = new Headers({ authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6Ikp...' });
    const result = maskSensitiveHeaders(headers);
    expect(result['authorization']).toBe('Bearer e***');
  });

  it('masks short sensitive values completely', () => {
    const headers = new Headers({ apikey: 'abc' });
    const result = maskSensitiveHeaders(headers);
    expect(result['apikey']).toBe('***');
  });

  it('does NOT mask non-sensitive headers', () => {
    const headers = new Headers({
      'content-type': 'application/json',
      'user-agent': 'Evolution/1.0',
      'x-custom-header': 'some-value',
    });
    const result = maskSensitiveHeaders(headers);
    expect(result['content-type']).toBe('application/json');
    expect(result['user-agent']).toBe('Evolution/1.0');
    expect(result['x-custom-header']).toBe('some-value');
  });

  it('handles mixed sensitive and non-sensitive headers', () => {
    const headers = new Headers({
      'content-type': 'application/json',
      'apikey': 'long-secret-value-here',
      'x-webhook-secret': 'another-long-secret',
      'accept': '*/*',
    });
    const result = maskSensitiveHeaders(headers);
    expect(result['content-type']).toBe('application/json');
    expect(result['apikey']).toBe('long-sec***');
    expect(result['x-webhook-secret']).toBe('another-***');
    expect(result['accept']).toBe('*/*');
  });

  it('handles token and password keywords', () => {
    const headers = new Headers({
      'x-auth-token': 'my-long-token-value',
      'x-password': 'my-long-password-value',
    });
    const result = maskSensitiveHeaders(headers);
    expect(result['x-auth-token']).toBe('my-long-***');
    expect(result['x-password']).toBe('my-long-***');
  });

  it('handles empty headers', () => {
    const headers = new Headers();
    const result = maskSensitiveHeaders(headers);
    expect(Object.keys(result)).toHaveLength(0);
  });
});
