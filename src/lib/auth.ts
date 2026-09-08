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

export interface GoogleJwtPayload {
  iss?: string;
  aud?: string;
  sub: string;
  email: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email_verified?: boolean;
  exp?: number;
}

export function parseGoogleJwt(credential: string): GoogleJwtPayload | null {
  try {
    const parts = credential.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const binaryStr = atob(padded);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const decodedText = new TextDecoder('utf-8').decode(bytes);
    const parsed = JSON.parse(decodedText) as GoogleJwtPayload;
    if (!parsed || typeof parsed !== 'object' || !parsed.email) return null;
    return parsed;
  } catch (e) {
    console.error('Failed to parse Google JWT credential:', e);
    return null;
  }
}

export interface ResumeSnapshotLike {
  fullName?: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  location?: string;
  profileLink?: string;
  importantDate?: string;
  importantPlace?: string;
  summary?: string;
  experiences?: any[];
  skillsInput?: string;
  educationItems?: any[];
  educationDegree?: string;
  educationSchool?: string;
  educationYear?: string;
  projectsInput?: string;
  certificationsInput?: string;
  languagesInput?: string;
  hobbiesInput?: string;
  achievementsInput?: string;
  volunteerInput?: string;
  customColumns?: any[];
  jobDescriptionInput?: string;
  selectedTemplateId?: string;
  selectedTemplateName?: string;
  listStyle?: string;
  photoDataUrl?: string;
  sectionSelectionOrder?: string[];
  [key: string]: any;
}

export interface StoredResumeHistoryEntry {
  id: string;
  savedAt: string;
  note: string;
  snapshot: ResumeSnapshotLike;
}

export interface MigrateGuestResumeResult {
  migrated: boolean;
  draft?: ResumeSnapshotLike;
  historyEntry?: StoredResumeHistoryEntry;
}

export const isDraftPopulated = (draft?: ResumeSnapshotLike | null): boolean => {
  if (!draft || typeof draft !== 'object') return false;
  const name = draft.fullName?.trim();
  const title = draft.jobTitle?.trim();
  const email = draft.email?.trim();
  const summary = draft.summary?.trim();
  const hasExperiences = Array.isArray(draft.experiences) && draft.experiences.length > 0;
  const hasSkills = Boolean(draft.skillsInput?.trim());

  return Boolean(name || title || email || summary || hasExperiences || hasSkills);
};

export const migrateGuestResumeToUser = (userId: string): MigrateGuestResumeResult => {
  if (!userId || typeof window === 'undefined') {
    return { migrated: false };
  }

  try {
    const guestDraftKey = buildUserScopedStorageKey(RESUME_DRAFT_STORAGE_KEY, null);
    const userDraftKey = buildUserScopedStorageKey(RESUME_DRAFT_STORAGE_KEY, userId);
    const userHistoryKey = buildUserScopedStorageKey(RESUME_HISTORY_STORAGE_KEY, userId);

    const rawGuestDraft = window.localStorage.getItem(guestDraftKey);
    if (!rawGuestDraft) {
      return { migrated: false };
    }

    const guestDraft = JSON.parse(rawGuestDraft) as ResumeSnapshotLike;
    if (!isDraftPopulated(guestDraft)) {
      return { migrated: false };
    }

    // Always ensure the user's active draft receives this resume
    window.localStorage.setItem(userDraftKey, JSON.stringify(guestDraft));

    // Also create a resume history entry for the user so it appears in history and dashboard
    const historyEntry: StoredResumeHistoryEntry = {
      id: `resume-${Date.now()}`,
      savedAt: new Date().toISOString(),
      note: 'Draft saved upon signing in',
      snapshot: guestDraft,
    };

    let userHistory: StoredResumeHistoryEntry[] = [];
    const rawUserHistory = window.localStorage.getItem(userHistoryKey);
    if (rawUserHistory) {
      try {
        const parsed = JSON.parse(rawUserHistory);
        if (Array.isArray(parsed)) {
          userHistory = parsed;
        }
      } catch {
        userHistory = [];
      }
    }

    // Prepend new history entry (deduping if identical snapshot is already present)
    const guestHash = JSON.stringify(guestDraft);
    const existingIndex = userHistory.findIndex((item) => JSON.stringify(item.snapshot) === guestHash);
    if (existingIndex !== 0) {
      if (existingIndex > 0) {
        userHistory.splice(existingIndex, 1);
      }
      userHistory.unshift(historyEntry);
      window.localStorage.setItem(userHistoryKey, JSON.stringify(userHistory.slice(0, MAX_RESUME_HISTORY_ITEMS)));
    }

    // Clear guest draft so subsequent guest visits don't overwrite with stale data
    window.localStorage.removeItem(guestDraftKey);

    return {
      migrated: true,
      draft: guestDraft,
      historyEntry,
    };
  } catch (error) {
    console.error('Failed to migrate guest resume to user account:', error);
    return { migrated: false };
  }
};

export const persistSignedInUser = (user: AuthUser, accessToken: string) => {
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  setStoredAuthTokens(accessToken);
  if (user?.id) {
    migrateGuestResumeToUser(user.id);
  }
};

