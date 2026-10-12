import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let api: typeof import('./backendApi').backendApi;
let auth: typeof import('./auth');
function storage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() { return entries.size; },
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => { entries.set(key, value); },
    removeItem: (key) => { entries.delete(key); },
    clear: () => entries.clear(),
    key: (index) => [...entries.keys()][index] ?? null,
  };
}
const response = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('window', {
    localStorage: storage(), sessionStorage: storage(),
    location: { hostname: 'localhost', pathname: '/enterprise', search: '', href: '/enterprise' },
  });
  auth = await import('./auth');
  api = (await import('./backendApi')).backendApi;
  auth.setStoredAuthTokens('expired-access');
  window.localStorage.setItem('redresumes_user', JSON.stringify({ id: 'faculty-a' }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Enterprise session renewal', () => {
  it('retries expired access and replaces stale dashboard token arguments on later requests', async () => {
    let refreshes = 0;
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
      if (String(url).endsWith('/auth/refresh')) {
        refreshes++;
        expect(options?.credentials).toBe('include');
        return response(200, { accessToken: 'renewed-access' });
      }
      const token = (options?.headers as Record<string, string>)?.Authorization;
      return token === 'Bearer renewed-access' ? response(200, { success: true }) : response(401, {});
    });
    await api.enterprise.getStats('expired-access');
    expect(auth.getStoredAccessToken()).toBe('renewed-access');
    await api.enterprise.getStats('expired-access');
    expect(refreshes).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(window.location.href).toBe('/enterprise');
  });

  it('shares one refresh across concurrent failures, including late 401 responses', async () => {
    const renewal = deferred<Response>();
    const late401 = deferred<Response>();
    let refreshes = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
      if (String(url).endsWith('/auth/refresh')) { refreshes++; return renewal.promise; }
      if ((options?.headers as Record<string, string>).Authorization === 'Bearer renewed-access') return response(200, {});
      if (String(url).includes('filter-options')) return late401.promise;
      return response(401, {});
    });
    const stats = api.enterprise.getStats('expired-access');
    const filters = api.enterprise.getFilterOptions('expired-access');
    const reports = api.enterprise.getReportSummary({}, 'expired-access');
    await vi.waitFor(() => expect(refreshes).toBe(1));
    renewal.resolve(response(200, { accessToken: 'renewed-access' }));
    await stats;
    late401.resolve(response(401, {}));
    await Promise.all([filters, reports]);
    expect(refreshes).toBe(1);
  });

  it('allows one waiter to cancel without cancelling renewal for other callers', async () => {
    const renewal = deferred<Response>();
    let refreshes = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
      if (String(url).endsWith('/auth/refresh')) {
        refreshes++;
        expect(options?.signal).toBeUndefined();
        return renewal.promise;
      }
      return (options?.headers as Record<string, string>).Authorization === 'Bearer renewed-access'
        ? response(200, {}) : response(401, {});
    });
    const controller = new AbortController();
    const cancelled = api.enterprise.getStats('expired-access', controller.signal).catch((error) => error);
    const survivor = api.enterprise.getFilterOptions('expired-access');
    await vi.waitFor(() => expect(refreshes).toBe(1));
    controller.abort();
    expect((await cancelled).name).toBe('AbortError');
    renewal.resolve(response(200, { accessToken: 'renewed-access' }));
    await survivor;
    expect(auth.getStoredAccessToken()).toBe('renewed-access');
    expect(refreshes).toBe(1);
  });

  it.each([401, 403])('clears the session and redirects when renewal rejects with %s', async (status) => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
      String(url).endsWith('/auth/refresh') ? response(status, {}) : response(401, {}));
    await expect(api.enterprise.getStats('expired-access')).rejects.toThrow('Session expired');
    expect(auth.getStoredAccessToken()).toBeNull();
    expect(window.localStorage.getItem('redresumes_user')).toBeNull();
    expect(window.location.href).toBe('/login?redirect=%2Fenterprise');
  });

  it('does not log out on transient refresh service failures', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
      String(url).endsWith('/auth/refresh') ? response(503, {}) : response(401, {}));
    await expect(api.enterprise.getStats('expired-access')).rejects.toThrow('Unable to renew');
    expect(auth.getStoredAccessToken()).toBe('expired-access');
    expect(window.location.href).toBe('/enterprise');
  });

  it('limits the retry when the replacement access token also receives 401', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) =>
      String(url).endsWith('/auth/refresh') ? response(200, { accessToken: 'renewed-access' }) : response(401, {}));
    await expect(api.enterprise.getStats('expired-access')).rejects.toThrow('Unauthorized');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not restore a session after logout while renewal is in flight', async () => {
    const renewal = deferred<Response>();
    let refreshes = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).endsWith('/auth/refresh')) { refreshes++; return renewal.promise; }
      return response(401, {});
    });
    const pending = api.enterprise.getStats('expired-access');
    await vi.waitFor(() => expect(refreshes).toBe(1));
    auth.clearStoredAuthTokens();
    renewal.resolve(response(200, { accessToken: 'renewed-access' }));
    await expect(pending).rejects.toThrow('Session changed');
    expect(auth.getStoredAccessToken()).toBeNull();
  });

  it('shares renewal when a stored user has no access token', async () => {
    auth.clearStoredAuthTokens();
    let refreshes = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, options) => {
      if (String(url).endsWith('/auth/refresh')) { refreshes++; return response(200, { accessToken: 'renewed-access' }); }
      expect((options?.headers as Record<string, string>).Authorization).toBe('Bearer renewed-access');
      return response(200, {});
    });
    await Promise.all([api.enterprise.getStats(), api.enterprise.getFilterOptions()]);
    expect(refreshes).toBe(1);
  });
});
