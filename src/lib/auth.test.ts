import { describe, expect, it } from 'vitest';
import { parseGoogleJwt, sanitizeRedirectUrl } from './auth';

describe('parseGoogleJwt', () => {
  it('correctly decodes a valid Google JWT ID token', () => {
    const payload = {
      iss: 'https://accounts.google.com',
      sub: 'google-sub-123456',
      email: 'pratyakshchauhan744@gmail.com',
      email_verified: true,
      name: 'Pratyaksh Chauhan',
      picture: 'https://lh3.googleusercontent.com/a/avatar.png',
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const fakeSignature = 'fake-sig';
    const token = `${header}.${body}.${fakeSignature}`;

    const result = parseGoogleJwt(token);
    expect(result).not.toBeNull();
    expect(result?.email).toBe('pratyakshchauhan744@gmail.com');
    expect(result?.name).toBe('Pratyaksh Chauhan');
    expect(result?.sub).toBe('google-sub-123456');
    expect(result?.picture).toBe('https://lh3.googleusercontent.com/a/avatar.png');
  });

  it('handles UTF-8 characters properly', () => {
    const payload = {
      sub: 'user-utf8',
      email: 'user@example.com',
      name: 'José González',
    };
    const header = Buffer.from(JSON.stringify({ alg: 'RS256' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
    const token = `${header}.${body}.sig`;

    const result = parseGoogleJwt(token);
    expect(result?.name).toBe('José González');
    expect(result?.email).toBe('user@example.com');
  });

  it('returns null for malformed token', () => {
    expect(parseGoogleJwt('not-a-jwt')).toBeNull();
    expect(parseGoogleJwt('')).toBeNull();
  });
});

describe('sanitizeRedirectUrl', () => {
  it('allows safe relative paths', () => {
    expect(sanitizeRedirectUrl('/dashboard')).toBe('/dashboard');
    expect(sanitizeRedirectUrl('/interview/setup')).toBe('/interview/setup');
    expect(sanitizeRedirectUrl('/builder?template=modern&draft=1')).toBe('/builder?template=modern&draft=1');
  });

  it('blocks absolute URLs and returns fallback', () => {
    expect(sanitizeRedirectUrl('https://evil.com')).toBe('/dashboard');
    expect(sanitizeRedirectUrl('http://evil.com/phish')).toBe('/dashboard');
    expect(sanitizeRedirectUrl('https://redresumes.com.attacker.com')).toBe('/dashboard');
  });

  it('blocks protocol-relative URLs (//evil.com)', () => {
    expect(sanitizeRedirectUrl('//evil.com')).toBe('/dashboard');
    expect(sanitizeRedirectUrl('//evil.com/login')).toBe('/dashboard');
  });

  it('blocks backslash bypass attempts (/\\evil.com)', () => {
    expect(sanitizeRedirectUrl('/\\evil.com')).toBe('/dashboard');
    expect(sanitizeRedirectUrl('/\\/evil.com')).toBe('/dashboard');
  });

  it('blocks javascript: and data: URI schemes', () => {
    expect(sanitizeRedirectUrl('javascript:alert(1)')).toBe('/dashboard');
    expect(sanitizeRedirectUrl('data:text/html,<script>alert(1)</script>')).toBe('/dashboard');
  });

  it('handles empty, null, and undefined values with fallback', () => {
    expect(sanitizeRedirectUrl(null)).toBe('/dashboard');
    expect(sanitizeRedirectUrl(undefined)).toBe('/dashboard');
    expect(sanitizeRedirectUrl('')).toBe('/dashboard');
    expect(sanitizeRedirectUrl('   ')).toBe('/dashboard');
    expect(sanitizeRedirectUrl(null, '/home')).toBe('/home');
  });
});
