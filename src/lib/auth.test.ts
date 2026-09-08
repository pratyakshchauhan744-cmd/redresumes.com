import { describe, expect, it } from 'vitest';
import { parseGoogleJwt } from './auth';

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
