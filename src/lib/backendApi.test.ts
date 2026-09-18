import { afterEach, describe, expect, it, vi } from 'vitest';
import { __internal, backendApi, mapBackendJobToUiJob, resolveApiBaseUrl } from './backendApi';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('backendApi runtime parsers', () => {
  it('parses valid auth response and defaults credits to 0 for new user', () => {
    const parsed = __internal.parseAuthResponse({
      accessToken: 'token',
      user: { id: 'u1', name: 'Alex', email: 'alex@example.com', role: 'candidate' }
    });
    expect(parsed.user.email).toBe('alex@example.com');
    expect(parsed.user.credits).toBe(0);
  });

  it('preserves existing credits in auth response', () => {
    const parsed = __internal.parseAuthResponse({
      accessToken: 'token',
      user: { id: 'u1', name: 'Alex', email: 'alex@example.com', role: 'candidate', credits: 15 }
    });
    expect(parsed.user.credits).toBe(15);
  });

  it('throws for invalid auth response', () => {
    expect(() => __internal.parseAuthResponse({})).toThrow();
  });

  it('parses valid ATS response', () => {
    const parsed = __internal.parseAtsScore({
      score: 80,
      matchedKeywords: ['sql'],
      missingKeywords: ['python'],
      strengths: ['good'],
      improvements: ['add metrics']
    });
    expect(parsed.score).toBe(80);
  });
});

describe('mapBackendJobToUiJob', () => {
  it('maps INR salary to lakhs format', () => {
    const mapped = mapBackendJobToUiJob({
      id: 'j1',
      title: 'Engineer',
      description: 'Job desc',
      remoteType: 'remote',
      employmentType: 'full_time',
      experienceLevel: 'mid',
      salaryMin: 800000,
      salaryMax: 1200000,
      currency: 'INR',
      company: { id: 'c1', name: 'Acme', website: 'https://acme.com' }
    });
    expect(mapped.salary).toContain('Rs');
    expect(mapped.companyUrl).toBe('https://acme.com');
  });
});

describe('resolveApiBaseUrl', () => {
  it('uses same-origin API on hosted sites when env accidentally points to localhost', () => {
    expect(resolveApiBaseUrl('http://localhost:4001', 'redresumescom.vercel.app')).toBe('');
  });

  it('keeps localhost API during local development', () => {
    expect(resolveApiBaseUrl('http://localhost:4001', 'localhost')).toBe('http://localhost:4001');
  });
});

describe('local access tokens', () => {
  it('does not try to refresh or clear auth when a local token hits a protected endpoint', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ message: 'Invalid or expired token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }));

    await expect(backendApi.getMe('local-demo-token')).rejects.toThrow('live backend session');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('error handling and edge response sanitization', () => {
  it('sanitizes Vercel edge 404 NOT_FOUND error pages into a clean message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('The page could not be found NOT_FOUND bom1::xdnv9-1789713847420-f0403dc5b0de', {
        status: 404,
        headers: { 'Content-Type': 'text/plain' },
      })
    );

    await expect(
      backendApi.register({ name: 'Test User', email: 'test@example.com', password: 'Password@123' })
    ).rejects.toThrow('Requested endpoint was not found or backend is offline.');
  });

  it('rejects invalid HTML API response format with a clean message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<!DOCTYPE html><html><body>Error</body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })
    );

    await expect(
      backendApi.register({ name: 'Test User', email: 'test@example.com', password: 'Password@123' })
    ).rejects.toThrow('Cannot reach backend service. Invalid API response format.');
  });
});
