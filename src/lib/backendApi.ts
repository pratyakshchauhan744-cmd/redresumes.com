const configuredApiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const isBrowser = typeof window !== "undefined";
const API_BASE_URL = resolveApiBaseUrl(configuredApiBaseUrl, isBrowser ? window.location.hostname : undefined);

export function resolveApiBaseUrl(configuredUrl: string | undefined, hostname: string | undefined): string {
  const value = configuredUrl?.trim();
  if (!value) return "";

  // Ignore misconfigured Vercel env var pointing to Railway frontend
  if (value.includes("redresumescom-frontendorigin.up.railway.app")) {
    return "";
  }

  // Auto-prepend https:// if the value looks like a bare domain (no protocol)
  const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  const localHostnames = ["localhost", "127.0.0.1", "::1"];
  const isLocalHostname = hostname ? localHostnames.includes(hostname) : false;
  const isLocalUrl = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(normalized);

  // On production (non-local hostname), only use the API URL if it's NOT a localhost URL.
  // On local development, always use it.
  if (isLocalHostname || !isLocalUrl) {
    return normalized.replace(/\/+$/, "");
  }
  return "";
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type RequestOptions = {
  method?: HttpMethod;
  token?: string;
  body?: unknown;
  baseUrl?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function ensureObject(value: unknown, context: string): Record<string, unknown> {
  if (!isObject(value)) throw new Error(`Invalid ${context}: expected object response.`);
  return value;
}

function ensureString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`Invalid response field: ${field}`);
  return value;
}

function ensureNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || Number.isNaN(value)) throw new Error(`Invalid response field: ${field}`);
  return value;
}

function ensureStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Invalid response field: ${field}`);
  }
  return value;
}

function optionalStringOrNull(value: unknown): string | null | undefined {
  if (typeof value === "string") return value;
  if (value === null) return null;
  return undefined;
}

function optionalNumberOrNull(value: unknown): number | null | undefined {
  if (typeof value === "number") return value;
  if (value === null) return null;
  return undefined;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let response: Response;
  const baseUrl = options.baseUrl ?? API_BASE_URL;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  } catch {
    throw new Error(`Cannot reach backend at ${baseUrl || "same-origin"}. Start backend server and verify VITE_API_BASE_URL.`);
  }

  if (!response.ok) {
    const fallbackByStatus: Record<number, string> = {
      400: "Bad request. Please check the form and try again.",
      401: "Unauthorized. Please sign in again.",
      403: "Forbidden. You do not have permission for this action.",
      404: "Requested endpoint was not found.",
      409: "This request conflicts with existing data.",
      422: "Validation failed. Please check your input.",
      429: "Too many requests. Please wait and try again."
    };

    let errorMessage = fallbackByStatus[response.status]
      ?? (response.status >= 500
        ? "Service temporarily unavailable. Please try again shortly."
        : "Unable to complete request. Please check your input and try again.");

    try {
      const raw = await response.text();
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (typeof parsed === "string") {
            errorMessage = parsed;
          } else if (isObject(parsed)) {
            const message = parsed.message;
            const error = parsed.error;
            const detail = parsed.detail;
            if (typeof message === "string" && message.trim()) {
              errorMessage = message;
            } else if (typeof error === "string" && error.trim()) {
              errorMessage = error;
            } else if (typeof detail === "string" && detail.trim()) {
              errorMessage = detail;
            }
          }
        } catch {
          if (raw.trim()) errorMessage = raw.trim();
        }
      }
    } catch {
      // keep fallback status message
    }

    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export type BackendJob = {
  id: string;
  title: string;
  description: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  remoteType: "onsite" | "hybrid" | "remote";
  employmentType: "full_time" | "part_time" | "contract" | "internship" | "freelance";
  experienceLevel: "entry" | "mid" | "senior" | "lead";
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency?: string | null;
  applyUrl?: string | null;
  postedAt?: string;
  company?:
    | {
    id: string;
    name: string;
    website?: string | null;
      }
    | string;
};

export type JobsListResponse = {
  total: number;
  page: number;
  limit: number;
  items: BackendJob[];
};

export type JobFilters = {
  keyword?: string;
  location?: string;
  remoteType?: "onsite" | "hybrid" | "remote";
  employmentType?: "full_time" | "part_time" | "contract" | "internship" | "freelance";
  experienceLevel?: "entry" | "mid" | "senior" | "lead";
  salaryMin?: number;
  salaryMax?: number;
  page?: number;
  limit?: number;
};

export type AtsScoreResponse = {
  score: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  strengths: string[];
  improvements: string[];
};

export type ImproveResumeResponse = {
  improvedSummary: string;
  improvedBullets: string[];
  keywordSuggestions: string[];
  atsTips: string[];
};

export type PublicResumeResponse = {
  id: string;
  slug: string;
  templateId: string;
  resumeData: unknown;
  updatedAt?: string;
};

function sameOriginRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return request<T>(path, { ...options, baseUrl: "" });
}

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt?: string;
  photoDataUrl?: string;
  phone?: string;
  location?: string;
  bio?: string;
};

export type TranslateResumeResponse = {
  jobTitle: string;
  location: string;
  summary: string;
  experiences: Array<{ title: string; dates: string; bullets: string[] }>;
  projects: string[];
  certifications: string[];
  languages: string[];
  achievements: string[];
  volunteer: string[];
  skills: string[];
  hobbies: string[];
};

function parseAuthUser(value: unknown): AuthUser {
  const obj = ensureObject(value, "user");
  return {
    id: ensureString(obj.id, "user.id"),
    name: ensureString(obj.name, "user.name"),
    email: ensureString(obj.email, "user.email"),
    role: ensureString(obj.role, "user.role"),
    createdAt: typeof obj.createdAt === "string" ? obj.createdAt : undefined,
    photoDataUrl: typeof obj.photoDataUrl === "string" ? obj.photoDataUrl : undefined,
    phone: typeof obj.phone === "string" ? obj.phone : undefined,
    location: typeof obj.location === "string" ? obj.location : undefined,
    bio: typeof obj.bio === "string" ? obj.bio : undefined
  };
}

function parseAuthResponse(value: unknown): { accessToken: string; user: AuthUser } {
  const obj = ensureObject(value, "auth response");
  return {
    accessToken: ensureString(obj.accessToken, "accessToken"),
    user: parseAuthUser(obj.user)
  };
}

function parseAtsScore(value: unknown): AtsScoreResponse {
  const obj = ensureObject(value, "ATS score");
  return {
    score: ensureNumber(obj.score, "score"),
    matchedKeywords: ensureStringArray(obj.matchedKeywords, "matchedKeywords"),
    missingKeywords: ensureStringArray(obj.missingKeywords, "missingKeywords"),
    strengths: ensureStringArray(obj.strengths, "strengths"),
    improvements: ensureStringArray(obj.improvements, "improvements")
  };
}

function parseImproveResume(value: unknown): ImproveResumeResponse {
  const obj = ensureObject(value, "improve response");
  return {
    improvedSummary: ensureString(obj.improvedSummary, "improvedSummary"),
    improvedBullets: ensureStringArray(obj.improvedBullets, "improvedBullets"),
    keywordSuggestions: ensureStringArray(obj.keywordSuggestions, "keywordSuggestions"),
    atsTips: ensureStringArray(obj.atsTips, "atsTips")
  };
}

function parseBackendJob(value: unknown): BackendJob {
  const obj = ensureObject(value, "job");
  return {
    id: ensureString(obj.id, "job.id"),
    title: ensureString(obj.title, "job.title"),
    description: ensureString(obj.description, "job.description"),
    city: optionalStringOrNull(obj.city),
    state: optionalStringOrNull(obj.state),
    country: optionalStringOrNull(obj.country),
    remoteType: ensureString(obj.remoteType, "job.remoteType") as BackendJob["remoteType"],
    employmentType: ensureString(obj.employmentType, "job.employmentType") as BackendJob["employmentType"],
    experienceLevel: ensureString(obj.experienceLevel, "job.experienceLevel") as BackendJob["experienceLevel"],
    salaryMin: optionalNumberOrNull(obj.salaryMin),
    salaryMax: optionalNumberOrNull(obj.salaryMax),
    currency: optionalStringOrNull(obj.currency),
    applyUrl: optionalStringOrNull(obj.applyUrl),
    postedAt: typeof obj.postedAt === "string" ? obj.postedAt : undefined,
    company: typeof obj.company === "string" || isObject(obj.company) ? (obj.company as BackendJob["company"]) : undefined
  };
}

function parseJobsList(value: unknown): JobsListResponse {
  const obj = ensureObject(value, "jobs list");
  if (!Array.isArray(obj.items)) throw new Error("Invalid jobs list: items");
  return {
    total: ensureNumber(obj.total, "total"),
    page: ensureNumber(obj.page, "page"),
    limit: ensureNumber(obj.limit, "limit"),
    items: obj.items.map(parseBackendJob)
  };
}

export const __internal = {
  parseAuthResponse,
  parseAtsScore,
  parseImproveResume,
  parseJobsList
};

function buildQuery(params: JobFilters): string {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });

  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

export const backendApi = {
  health: () => request<{ status: string; service: string }>("/health"),

  register: (body: { name: string; email: string; password: string; role?: "candidate" | "employer" | "admin" }) =>
    request<unknown>("/api/auth/register", { method: "POST", body }).then(parseAuthResponse),

  login: (body: { email: string; password: string }) =>
    request<unknown>(
      "/api/auth/login",
      { method: "POST", body }
    ).then(parseAuthResponse),

  googleLogin: (body: { credential: string }) =>
    request<unknown>("/api/auth/google", { method: "POST", body }).then(parseAuthResponse),

  startRegisterOtp: (body: { name: string; email: string; password: string; role?: "candidate" | "employer" | "admin" }) =>
    request<{ message: string; sessionId: string; expiresInSeconds: number; devOtp?: string }>(
      "/api/auth/register/start",
      { method: "POST", body }
    ),

  verifyRegisterOtp: (body: { sessionId: string; otp: string }) =>
    request<{ accessToken: string; user: AuthUser }>(
      "/api/auth/register/verify",
      { method: "POST", body }
    ),  startForgotPasswordOtp: (body: { email: string }) =>
    request<{ message: string; sessionId: string; expiresInSeconds: number; devOtp?: string }>(
      "/api/auth/forgot-password/start",
      { method: "POST", body }
    ),

  verifyForgotPasswordOtp: (body: { sessionId: string; otp: string }) =>
    request<{ message: string }>(
      "/api/auth/forgot-password/verify",
      { method: "POST", body }
    ),

  resetPassword: (body: { sessionId: string; password: string }) =>
    request<{ message: string }>(
      "/api/auth/forgot-password/reset",
      { method: "POST", body }
    ),

  refresh: () => request<{ accessToken: string }>("/api/auth/refresh", { method: "POST" }),

  logout: () => request<void>("/api/auth/logout", { method: "POST" }),

  listJobs: (filters: JobFilters = {}) => request<unknown>(`/api/jobs${buildQuery(filters)}`).then(parseJobsList),

  getJobById: (jobId: string) => request<unknown>(`/api/jobs/${jobId}`).then(parseBackendJob),

  saveJob: (jobId: string, token: string) => request(`/api/jobs/${jobId}/save`, { method: "POST", token }),

  applyToJob: (jobId: string, token: string, resumeUrl?: string) =>
    request(`/api/jobs/${jobId}/apply`, {
      method: "POST",
      token,
      body: resumeUrl ? { resumeUrl } : {}
    }),

  getMyApplications: (token: string) => request(`/api/users/me/applications`, { token }),

  getMySavedJobs: (token: string) => request(`/api/users/me/saved-jobs`, { token }),

  getMe: (token: string) => request<unknown>(`/api/users/me`, { token }).then(parseAuthUser),

  getAtsScore: (body: { resumeText: string; jobDescription: string }, token: string) =>
    request<unknown>("/api/ai/ats-score", { method: "POST", body, token }).then(parseAtsScore),

  improveResume: (body: {
    resumeText: string;
    jobDescription?: string;
    jobTitle?: string;
    focus?: "summary" | "bullets" | "full";
  }, token: string) => request<unknown>("/api/ai/improve-resume", { method: "POST", body, token }).then(parseImproveResume),

  translateResume: (body: {
    targetLanguage: "English" | "Hindi" | "Spanish" | "French";
    resume: {
      jobTitle: string;
      location: string;
      summary: string;
      experiences: Array<{ title: string; dates: string; bullets: string[] }>;
      projects: string[];
      certifications: string[];
      languages: string[];
      achievements: string[];
      volunteer: string[];
      skills: string[];
      hobbies: string[];
    };
  }, token: string) => request<TranslateResumeResponse>("/api/ai/translate-resume", { method: "POST", body, token }),

  publishPublicResume: (body: { slug: string; templateId: string; resumeData: unknown }) =>
    sameOriginRequest<PublicResumeResponse>("/api/public-resumes", { method: "POST", body }),

  getPublicResume: (id: string) =>
    sameOriginRequest<PublicResumeResponse>(`/api/public-resumes/${encodeURIComponent(id)}`),

  parseResume: async (file: File, token: string) => {
    const formData = new FormData();
    formData.append("resume", file);
    
    const response = await fetch(`${API_BASE_URL}/api/ai/parse-resume`, {
      method: "POST",
      credentials: "include",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData,
    });
    
    if (!response.ok) {
      let errorMessage = "Parse failed";
      try {
        const errorBody = await response.json();
        errorMessage = errorBody.error ?? errorBody.message ?? errorMessage;
      } catch {
        // ignore
      }
      throw new Error(errorMessage);
    }
    
    return response.json();
  }
};

export function mapBackendJobToUiJob(job: BackendJob): {
  id: string;
  title: string;
  company: string;
  companyUrl?: string;
  location: string;
  type: string;
  salary: string;
  match: number;
  skills: string[];
  url?: string;
  postedAt?: string;
} {
  const formatSalaryAmount = (amount: number, currency: string) => {
    if (currency === "INR") {
      if (amount >= 10000000) {
        return `Rs ${(amount / 10000000).toFixed(amount % 10000000 === 0 ? 0 : 1)} Cr`;
      }
      if (amount >= 100000) {
        return `Rs ${(amount / 100000).toFixed(amount % 100000 === 0 ? 0 : 1)} L`;
      }
    }

    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
      notation: "compact"
    }).format(amount);
  };

  const location = [job.city, job.state, job.country].filter(Boolean).join(", ") || "Remote / Global";
  const salary =
    job.salaryMin && job.salaryMax
      ? `${formatSalaryAmount(job.salaryMin, job.currency ?? "INR")} - ${formatSalaryAmount(job.salaryMax, job.currency ?? "INR")}`
      : "Competitive";

  return {
    id: job.id,
    title: job.title,
    company: typeof job.company === "string" ? job.company : job.company?.name ?? "Unknown Company",
    companyUrl: typeof job.company === "string" ? undefined : job.company?.website ?? undefined,
    location,
    type: job.remoteType,
    salary,
    match: 82,
    skills: [job.employmentType, job.experienceLevel].map((value) => value.replace("_", " ")),
    url: job.applyUrl ?? undefined,
    postedAt: job.postedAt
  };
}
