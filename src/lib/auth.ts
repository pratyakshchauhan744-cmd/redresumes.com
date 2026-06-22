import type { AuthUser } from './backendApi';

export const ACCESS_TOKEN_STORAGE_KEY = 'redresumes_access_token';
export const USER_STORAGE_KEY = 'redresumes_user';
export const LOCAL_ACCOUNTS_STORAGE_KEY = 'redresumes_local_accounts';
export const RESUME_HISTORY_STORAGE_KEY = 'redresumes_resume_history_v1';
export const RESUME_DRAFT_STORAGE_KEY = 'redresumes_resume_draft_v1';
export const SAVED_JOBS_STORAGE_KEY = 'redresumes_saved_jobs';
export const APPLIED_JOBS_STORAGE_KEY = 'redresumes_applied_jobs';
export const MAX_RESUME_HISTORY_ITEMS = 30;
export const AUTH_TOKEN_STORAGE = typeof window !== 'undefined' ? window.sessionStorage : {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  key: () => null,
  length: 0
} as unknown as Storage;

export const readStoredUser = (): AuthUser | null => {
  try {
    const raw = window.localStorage.getItem(USER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
};

export const getStoredAccessToken = (): string | null => {
  return AUTH_TOKEN_STORAGE.getItem(ACCESS_TOKEN_STORAGE_KEY) ?? window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
};

export const setStoredAuthTokens = (accessToken: string) => {
  AUTH_TOKEN_STORAGE.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
};

export const isLocalAccessToken = (accessToken?: string | null): boolean =>
  Boolean(accessToken && (accessToken.startsWith('offline-') || accessToken.startsWith('local-')));

export const clearStoredAuthTokens = () => {
  AUTH_TOKEN_STORAGE.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
};

export const buildUserScopedStorageKey = (baseKey: string, userId?: string | null): string =>
  userId ? `${baseKey}:${userId}` : `${baseKey}:guest`;

export const persistSignedInUser = (user: AuthUser, accessToken: string) => {
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  setStoredAuthTokens(accessToken);
};
