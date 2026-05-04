import { describe, expect, it } from 'vitest';
import { __internal, mapBackendJobToUiJob } from './backendApi';

describe('backendApi runtime parsers', () => {
  it('parses valid auth response', () => {
    const parsed = __internal.parseAuthResponse({
      accessToken: 'token',
      user: { id: 'u1', name: 'Alex', email: 'alex@example.com', role: 'candidate' }
    });
    expect(parsed.user.email).toBe('alex@example.com');
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
